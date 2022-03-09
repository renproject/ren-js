import { EventEmitter } from "events";
import { OrderedMap } from "immutable";

import { RenVMProvider } from "@renproject/provider";
import {
    Chain,
    ChainTransactionProgress,
    DefaultTxWaiter,
    ErrorWithCode,
    EventEmitterTyped,
    generateGHash,
    generatePHash,
    generateSHash,
    InputChainTransaction,
    InputType,
    isContractChain,
    isDepositChain,
    OutputType,
    RenJSError,
    TxSubmitter,
    TxWaiter,
    utils,
} from "@renproject/utils";

import { defaultRenJSConfig, RenJSConfig } from "./config";
import { estimateTransactionFee, GatewayFees } from "./fees";
import { GatewayTransaction, TransactionParams } from "./gatewayTransaction";
import { GatewayParams } from "./params";
import { getInputAndOutputTypes } from "./utils/inputAndOutputTypes";

class TransactionEmitter<
        ToPayload extends { chain: string; txConfig?: any } = any,
    >
    extends EventEmitter
    implements
        EventEmitterTyped<{ transaction: [GatewayTransaction<ToPayload>] }>
{
    private getTransactions: () => GatewayTransaction<ToPayload>[];

    public constructor(getTransactions: () => GatewayTransaction<ToPayload>[]) {
        super();

        this.getTransactions = getTransactions;
    }

    public addListener = <Event extends "transaction">(
        event: Event,
        callback: Event extends "transaction"
            ? // eslint-disable-next-line @typescript-eslint/no-explicit-any
              (deposit: GatewayTransaction<ToPayload>) => void
            : never,
    ): this => {
        // Emit previous deposit events.
        if (event === "transaction") {
            this.getTransactions().map(callback);
        }

        super.on(event, callback);
        return this;
    };

    /**
     * `on` creates a new listener to `"transaction"` events, returning
     * [[GatewayTransaction]] instances.
     *
     * `on` extends `EventEmitter.on`, modifying it to immediately return all
     * previous `"transaction"` events, in addition to new events, when a new
     * listener is created.
     *
     * @category Main
     */
    // @ts-expect-error EventEmitter and EventEmitterTyped typing issue
    public on = <Event extends "transaction">(
        event: Event,
        callback: Event extends "transaction"
            ? (deposit: GatewayTransaction<ToPayload>) => void
            : never,
    ): this => this.addListener(event, callback);
}

/**
 *
 *
 * `LockAndMint` extends the EventEmitter class, and emits a `"transaction"` event
 * for each new deposit that is observed. Deposits will only be watched for if
 * there is an active listener for the `"transaction"` event.
 *
 * A LockAndMint object watches transactions to the [[gatewayAddress]] on the
 * lock-chain.
 *
 * Deposits to the gateway address can be listened to with the `"transaction"`
 * event using [[on]], which will return [[GatewayTransaction]] instances.
 *
 * ```ts
 * console.log(`Deposit to ${JSON.stringify(lockAndMint.gatewayAddress)}`);
 *
 * lockAndMint.on("transaction", async (deposit) => {
 *    console.log(`Received deposit`, deposit);
 *    await RenJS.defaultDepositHandler(deposit);
 * });
 * ```
 *
 * @noInheritDoc
 */
export class Gateway<
    FromPayload extends { chain: string; txConfig?: any } = any,
    ToPayload extends { chain: string; txConfig?: any } = any,
> {
    // Public

    /** The parameters passed in when creating the LockAndMint. */
    public readonly params: GatewayParams<FromPayload, ToPayload>;
    public readonly fromChain: Chain;
    public readonly toChain: Chain;
    public readonly provider: RenVMProvider;
    public readonly config: typeof defaultRenJSConfig & RenJSConfig;

    /**
     * The generated gateway address for the lock-chain.
     */
    public gatewayAddress: string | undefined;

    public inSetup: { [key: string]: TxSubmitter | TxWaiter } = {};
    public in:
        | TxSubmitter<ChainTransactionProgress, FromPayload["txConfig"]>
        | TxWaiter
        | undefined;

    /**
     * Deposits represents the lock deposits that have been detected so far.
     */
    public transactions: OrderedMap<
        string,
        GatewayTransaction<ToPayload> | Promise<GatewayTransaction<ToPayload>>
    > = OrderedMap<
        string,
        GatewayTransaction<ToPayload> | Promise<GatewayTransaction<ToPayload>>
    >();

    public eventEmitter: TransactionEmitter<ToPayload> =
        new TransactionEmitter<ToPayload>(() =>
            this.transactions
                // Check that the transaction isn't a promise.
                // The result of promises will be emitted when they resolve.
                .filter((tx) => (tx as any).then === undefined)
                .map((tx) => tx as GatewayTransaction<ToPayload>)
                .valueSeq()
                .toArray(),
        );

    // The following are set in the asynchronous "initialize" method that should
    // be called immediately after the constructor.

    private _selector: string | undefined;
    public get selector(): string {
        return this._defaultGetter("_selector") || this._selector;
    }

    private _gHash: Buffer | undefined;
    public get gHash(): Buffer {
        return this._defaultGetter("_gHash") || this._gHash;
    }

    private _pHash: Buffer | undefined;
    public get pHash(): Buffer {
        return this._defaultGetter("_pHash") || this._pHash;
    }

    private _fees: GatewayFees | undefined;
    public get fees(): GatewayFees {
        return this._defaultGetter("_fees") || this._fees;
    }

    private _outputType: OutputType | undefined;
    public get outputType(): OutputType {
        return this._defaultGetter("_outputType") || this._outputType;
    }

    private _inputType: InputType | undefined;
    public get inputType(): InputType {
        return this._defaultGetter("_inputType") || this._inputType;
    }

    private _inConfirmationTarget: number | undefined;
    public get inConfirmationTarget(): number {
        return (
            this._defaultGetter("_inConfirmationTarget") ||
            this._inConfirmationTarget
        );
    }

    /**
     * @hidden - should be created using [[RenJS.lockAndMint]] instead.
     */
    public constructor(
        renVM: RenVMProvider,
        fromChain: Chain,
        toChain: Chain,
        params: GatewayParams<FromPayload, ToPayload>,
        config: RenJSConfig = {},
    ) {
        this.params = params;
        this.fromChain = fromChain;
        this.toChain = toChain;
        this.provider = renVM;

        this.config = {
            ...defaultRenJSConfig,
            ...config,
        };

        {
            // Debug log
            this.config.logger.debug(
                "gateway created:",
                String(renVM.endpointOrProvider),
                fromChain.chain,
                toChain.chain,
                this.params,
                config,
            );
        }
    }

    /**
     * @hidden - Called automatically when calling [[RenJS.lockAndMint]]. It has
     * been split from the constructor because it's asynchronous.
     */
    public async initialize(): Promise<Gateway<FromPayload, ToPayload>> {
        const { to, asset, from } = this.params;

        const { inputType, outputType, selector } =
            await getInputAndOutputTypes({
                asset,
                fromChain: this.fromChain,
                toChain: this.toChain,
            });

        this._inputType = inputType;
        this._outputType = outputType;
        this._selector = selector;

        if (
            this.outputType === OutputType.Release &&
            !isContractChain(this.fromChain)
        ) {
            throw ErrorWithCode.from(
                new Error(
                    `Cannot release from non-contract chain ${this.fromChain.chain}`,
                ),
                RenJSError.PARAMETER_ERROR,
            );
        }

        if (
            this.outputType === OutputType.Mint &&
            !isContractChain(this.toChain)
        ) {
            throw ErrorWithCode.from(
                new Error(
                    `Cannot mint ${asset} to non-contract chain ${this.toChain.chain}`,
                ),
                RenJSError.PARAMETER_ERROR,
            );
        }

        const [confirmationTarget, shard, payload] = await Promise.all([
            this.provider.getConfirmationTarget(this.fromChain.chain),
            (async () => {
                if (utils.isDefined(this.params.shard)) {
                    return this.params.shard;
                }
                if (
                    this.inputType === InputType.Lock &&
                    isDepositChain(this.fromChain) &&
                    (await this.fromChain.isDepositAsset(asset))
                ) {
                    return await this.provider.selectShard(this.params.asset);
                } else {
                    return {
                        gPubKey: "",
                    };
                }
            })(),
            this.toChain.getOutputPayload(
                asset,
                this.inputType,
                this.outputType,
                to,
            ),
        ]);

        this.params.shard = shard;
        this._inConfirmationTarget = confirmationTarget;

        this._pHash = generatePHash(payload.payload);

        // const sHash = utils.Ox(generateSHash(this.selector));

        const sHash = generateSHash(
            `${this.params.asset}/to${this.params.to.chain}`,
        );

        if (
            isDepositChain(this.fromChain) &&
            (await this.fromChain.isDepositAsset(this.params.asset))
        ) {
            try {
                if (!isContractChain(this.toChain)) {
                    throw new Error(
                        `Cannot mint ${asset} to non-contract chain ${this.toChain.chain}.`,
                    );
                }

                if (!this.params.shard) {
                    throw ErrorWithCode.from(
                        new Error(`RenVM shard not selected.`),
                        RenJSError.INTERNAL_ERROR,
                    );
                }

                // Convert nonce to Buffer (using `0` if no nonce is set.)
                const nonce =
                    typeof this.params.nonce === "string"
                        ? utils.fromBase64(this.params.nonce)
                        : utils.toNBytes(this.params.nonce || 0, 32);

                const gHash = generateGHash(
                    this.pHash,
                    sHash,
                    payload.toBytes,
                    nonce,
                );
                this._gHash = gHash;
                const gPubKey = utils.fromBase64(this.params.shard.gPubKey);
                this.config.logger.debug("gPubKey:", utils.Ox(gPubKey));

                if (!gPubKey || gPubKey.length === 0) {
                    throw ErrorWithCode.from(
                        new Error("Unable to fetch RenVM shard public key."),
                        RenJSError.NETWORK_ERROR,
                    );
                }

                if (!gHash || gHash.length === 0) {
                    throw new Error(
                        "Invalid gateway hash being passed to gateway address generation.",
                    );
                }

                if (!asset || asset.length === 0) {
                    throw new Error(
                        "Invalid asset being passed to gateway address generation.",
                    );
                }

                const gatewayAddress =
                    await this.fromChain.createGatewayAddress(
                        this.params.asset,
                        this.params.from,
                        gPubKey,
                        gHash,
                    );
                this.gatewayAddress = gatewayAddress;

                const gatewayDetails = {
                    selector,
                    payload: payload.payload,
                    pHash: this.pHash,
                    to: payload.to,
                    nonce: nonce,
                    nHash: Buffer.from(
                        "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
                        "base64",
                    ),
                    gPubKey: gPubKey,
                    gHash: gHash,
                };

                // Submit the gateway details to the back-up submitGateway
                // endpoint.
                void utils
                    .POST(
                        "https://validate-mint.herokuapp.com/",
                        JSON.stringify({
                            gateway: gatewayAddress,
                            gatewayDetails,
                        }),
                    )
                    .catch(() => {
                        /* Ignore error. */
                    });

                try {
                    // Submit the gateway details to the submitGateway endpoint.
                    await utils.tryNTimes(async () => {
                        await this.provider.submitGateway(
                            gatewayAddress,
                            gatewayDetails,
                        );
                    }, 5);
                } catch (error: unknown) {
                    throw new ErrorWithCode(
                        `Error submitting gateway details: ${utils.extractError(
                            error,
                        )}`,
                        RenJSError.GATEWAY_SUBMISSION_FAILED,
                    );
                }

                this.config.logger.debug(
                    "gateway address:",
                    this.gatewayAddress,
                );

                // eslint-disable-next-line @typescript-eslint/no-explicit-any
            } catch (error: any) {
                throw error;
            }

            // Will fetch deposits as long as there's at least one subscription.
            this._watchForDeposits().catch(console.error);
        }

        if (isContractChain(this.fromChain)) {
            const processInput = (input: InputChainTransaction) => {
                const nonce = utils.toURLBase64(
                    // Check if the deposit has an associated nonce. This will
                    // be true for contract-based inputs.
                    input.nonce
                        ? utils.fromBase64(input.nonce)
                        : // Check if the params have a nonce - this can be
                        // a base64 string or a number. If no nonce is set,
                        // default to `0`.
                        typeof this.params.nonce === "string"
                        ? utils.fromBase64(this.params.nonce)
                        : utils.toNBytes(this.params.nonce || 0, 32),
                );

                const gHash = generateGHash(
                    payload.payload,
                    sHash,
                    payload.toBytes,
                    utils.fromBase64(nonce),
                );
                this._gHash = gHash;

                if (!gHash || gHash.length === 0) {
                    throw ErrorWithCode.from(
                        new Error(
                            "Invalid gateway hash being passed to gateway address generation.",
                        ),
                        RenJSError.PARAMETER_ERROR,
                    );
                }

                if (!asset || asset.length === 0) {
                    throw ErrorWithCode.from(
                        new Error(
                            "Invalid asset being passed to gateway address generation.",
                        ),
                        RenJSError.PARAMETER_ERROR,
                    );
                }

                // TODO: Add to queue instead so that it can be retried on error.
                this.processDeposit(input).catch(console.error);
            };

            // TODO
            const removeInput = () => {};

            this.in = await this.fromChain.getInputTx(
                this.inputType,
                this.outputType,
                asset,
                from,
                () => ({
                    toChain: to.chain,
                    toPayload: payload,
                    gatewayAddress: this.gatewayAddress,
                }),
                this.inConfirmationTarget,
                processInput,
                removeInput,
            );
        }

        this._fees = await estimateTransactionFee(
            this.provider,
            asset,
            this.fromChain,
            this.toChain,
        );

        if (isContractChain(this.fromChain) && this.fromChain.getInSetup) {
            this.inSetup = {
                ...this.inSetup,
                ...(await this.fromChain.getInSetup(
                    asset,
                    this.inputType,
                    this.outputType,
                    from,
                    () => ({
                        toChain: to.chain,
                        toPayload: payload,
                        gatewayAddress: this.gatewayAddress,
                    }),
                )),
            };
        }

        return this;
    }

    /**
     * `processDeposit` allows you to manually provide the details of a deposit
     * and returns a [[GatewayTransaction]] object.
     *
     * @param deposit The deposit details in the format defined by the
     * LockChain. This should be the same format as `deposit.depositDetails` for
     * a deposit returned from `.on("transaction", ...)`.
     *
     * ```ts
     * lockAndMint
     *   .processDeposit({
     *       transaction: {
     *           cid:
     *               "bafy2bzacedvu74e7ohjcwlh4fbx7ddf6li42fiuosajob6metcj2qwkgkgof2",
     *           to: "t1v2ftlxhedyoijv7uqgxfygiziaqz23lgkvks77i",
     *           amount: (0.01 * 1e8).toString(),
     *           params: "EzGbvVHf8lb0v8CUfjh8y+tLbZzfIFcnNnt/gh6axmw=",
     *           confirmations: 1,
     *           nonce: 7,
     *       },
     *       amount: (0.01 * 1e8).toString(),
     *   })
     *   .on(deposit => RenJS.defaultDepositHandler)
     *   .catch(console.error);
     * ```
     * @category Main
     */
    public async processDeposit(
        deposit: InputChainTransaction,
    ): Promise<GatewayTransaction<ToPayload>> {
        const depositIdentifier = deposit.txid + "_" + String(deposit.txindex);
        const existingTransaction = this.transactions.get(depositIdentifier);

        // If the transaction hasn't been seen before.
        // eslint-disable-next-line @typescript-eslint/no-misused-promises
        if (!existingTransaction) {
            const createGatewayTransaction = async () => {
                if (!this.pHash || !this.gHash) {
                    throw new Error(
                        "Gateway address must be generated before calling 'processDeposit'.",
                    );
                }

                // Determine which nonce to use - converting it to a Buffer
                // to ensure it's in a standard format before calling
                // utils.toURLBase64 again.
                const nonce = utils.toURLBase64(
                    // Check if the deposit has an associated nonce. This will
                    // be true for contract-based inputs.
                    deposit.nonce
                        ? utils.fromBase64(deposit.nonce)
                        : // Check if the params have a nonce - this can be
                        // a base64 string or a number. If no nonce is set,
                        // default to `0`.
                        typeof this.params.nonce === "string"
                        ? utils.fromBase64(this.params.nonce)
                        : utils.toNBytes(this.params.nonce || 0, 32),
                );

                const params: TransactionParams<ToPayload> = {
                    asset: this.params.asset,
                    fromTx: deposit,
                    to: this.params.to,

                    shard: this.params.shard,
                    nonce,
                };

                let inTx = this.in;
                if (!inTx) {
                    inTx = new DefaultTxWaiter({
                        chainTransaction: deposit,
                        chain: this.fromChain,
                        target: this.inConfirmationTarget,
                    });
                }

                const transaction = new GatewayTransaction<ToPayload>(
                    this.provider,
                    this.fromChain,
                    this.toChain,
                    params,
                    inTx,
                    this.config,
                );

                await transaction.initialize();

                // Check if deposit has already been submitted.
                this.eventEmitter.emit("transaction", transaction);
                // this.deposits.set(deposit);
                this.config.logger.debug("new deposit:", deposit);

                return transaction;
            };

            const promise = createGatewayTransaction();

            this.transactions = this.transactions.set(
                depositIdentifier,
                promise,
            );

            try {
                this.transactions = this.transactions.set(
                    depositIdentifier,
                    await promise,
                );
            } catch (error) {
                this.transactions = this.transactions.remove(depositIdentifier);
            }
        }
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        return (await existingTransaction)!;
    }

    public on<Event extends "transaction">(
        event: Event,
        callback: Event extends "transaction"
            ? (deposit: GatewayTransaction<ToPayload>) => void
            : never,
    ): this {
        this.eventEmitter.on(event, callback);
        return this;
    }

    /** PRIVATE METHODS */

    private _defaultGetter(name: string) {
        if (this[name] === undefined) {
            throw new Error(
                `Must call 'initialize' before accessing '${name}'.`,
            );
        }
        return this[name];
    }

    private async _watchForDeposits(): Promise<void> {
        if (
            !this.gatewayAddress ||
            !isDepositChain(this.fromChain) ||
            !this.fromChain.watchForDeposits
        ) {
            return;
        }

        while (true) {
            const listenerCancelled = () =>
                this.eventEmitter.listenerCount("transaction") === 0;

            try {
                // If there are no listeners, continue. TODO: Exit loop entirely
                // until a lister is added again.
                if (listenerCancelled()) {
                    await utils.sleep(1 * utils.sleep.SECONDS);
                    continue;
                }
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
            } catch (error: any) {
                this.config.logger.error(utils.extractError(error));
            }

            // Change the return type of `this.processDeposit` to `void`.
            const onDeposit = (deposit: InputChainTransaction): void => {
                try {
                    // TODO: Handle error.
                    this.processDeposit(deposit).catch(console.error);
                } catch (error) {
                    this.config.logger.error(error);
                }
            };

            // TODO: Flag deposits that have been cancelled, updating their status.
            const cancelDeposit = () => {};

            try {
                await this.fromChain.watchForDeposits(
                    this.params.asset,
                    this.params.from,
                    this.gatewayAddress,
                    onDeposit,
                    cancelDeposit,
                    listenerCancelled,
                );
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
            } catch (error: any) {
                this.config.logger.error(utils.extractError(error));
            }

            await utils.sleep(this.config.networkDelay);
        }
    }
}
