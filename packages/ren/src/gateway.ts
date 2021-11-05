import { EventEmitter } from "events";
import { OrderedMap } from "immutable";

import { RenVMProvider } from "@renproject/provider";
import {
    Chain,
    extractError,
    fromBase64,
    generateGHash,
    generatePHash,
    generateSHash,
    InputChainTransaction,
    InputType,
    isContractChain,
    isDefined,
    isDepositChain,
    OutputType,
    Ox,
    RenJSError,
    SECONDS,
    sleep,
    toNBytes,
    toURLBase64,
    TxSubmitter,
    TxWaiter,
    withCode,
} from "@renproject/utils";

import { defaultRenJSConfig, RenJSConfig } from "./config";
import { estimateTransactionFee, GatewayFees } from "./fees";
import { GatewayTransaction, TransactionParams } from "./gatewayTransaction";
import { GatewayParams } from "./params";
import { getInputAndOutputTypes } from "./utils/inputAndOutputTypes";

/**
 * A `LockAndMint` object tied to a particular gateway address. LockAndMint
 * should not be created directly. Instead, [[RenJS.lockAndMint]] will create a
 * `LockAndMint` object.
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
    FromPayload extends { chain: string } = {
        chain: string;
    },
    ToPayload extends { chain: string } = {
        chain: string;
    },
> extends EventEmitter {
    // Public

    /**
     * The generated gateway address for the lock-chain. For chains such as BTC
     * this is a string. For other chains, this may be an object, so the method
     * of showing this address to users should be implemented on a
     * chain-by-chain basis.
     */
    private _gatewayAddress: string | undefined;
    public gatewayAddress = (): string => {
        if (!this._gatewayAddress) {
            throw new Error("Not initialized.");
        }
        return this._gatewayAddress;
    };

    /** The parameters passed in when creating the LockAndMint. */
    public params: GatewayParams<FromPayload, ToPayload>;
    public fromChain: Chain;
    public toChain: Chain;

    /** See [[RenJS.renVM]]. */
    public provider: RenVMProvider;

    public selector: string = "";

    public _config: typeof defaultRenJSConfig & RenJSConfig;

    /**
     * Deposits represents the lock deposits that have been detected so far.
     */
    private transactions: OrderedMap<
        string,
        GatewayTransaction<ToPayload> | Promise<GatewayTransaction<ToPayload>>
    > = OrderedMap<
        string,
        GatewayTransaction<ToPayload> | Promise<GatewayTransaction<ToPayload>>
    >();

    private targetConfirmations: number | undefined;
    public gPubKey: Buffer | undefined;
    public gHash: Buffer | undefined;
    public pHash: Buffer | undefined;

    public in: TxSubmitter | TxWaiter | undefined;

    public setup: { [key: string]: TxSubmitter | TxWaiter } = {};

    public fees: GatewayFees;

    // public fees {
    // }

    public inputType: InputType;
    public outputType: OutputType;

    /**
     * @hidden - should be created using [[RenJS.lockAndMint]] instead.
     */
    constructor(
        renVM: RenVMProvider,
        fromChain: Chain,
        toChain: Chain,
        params: GatewayParams<FromPayload, ToPayload>,
        config: RenJSConfig = {},
    ) {
        super();

        this.params = params;
        this.fromChain = fromChain;
        this.toChain = toChain;
        this.provider = renVM;

        this._config = {
            ...defaultRenJSConfig,
            ...config,
        };

        // Set in async constructor, `_initialize`.
        this.inputType = undefined as never;
        this.outputType = undefined as never;
        this.fees = undefined as never;

        {
            // Debug log
            const { to: _to, from: _from, ...restOfParams } = this.params;
            this._config.logger.debug("lockAndMint created:", restOfParams);
        }
    }

    /**
     * @hidden - Called automatically when calling [[RenJS.lockAndMint]]. It has
     * been split from the constructor because it's asynchronous.
     */
    public readonly _initialize = async (): Promise<
        Gateway<FromPayload, ToPayload>
    > => {
        // Check if shard needs to be selected.
        if (!isDefined(this.params.shard)) {
            this.params.shard = await this.provider.selectShard(
                this.params.asset,
            );
        }

        const { to, asset, from } = this.params;

        const { inputType, outputType, selector } =
            await getInputAndOutputTypes({
                asset,
                fromChain: this.fromChain,
                toChain: this.toChain,
            });
        this.inputType = inputType;
        this.outputType = outputType;
        this.selector = selector;

        try {
            this.targetConfirmations = await this.confirmationTarget();
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } catch (error: any) {
            console.error(error);
        }

        if (
            this.outputType === OutputType.Release &&
            !isContractChain(this.fromChain)
        ) {
            throw withCode(
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
            throw withCode(
                new Error(
                    `Cannot mint ${asset} to non-contract chain ${this.toChain.chain}`,
                ),
                RenJSError.PARAMETER_ERROR,
            );
        }

        const payload = await this.toChain.getOutputPayload(
            asset,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            this.outputType as any,
            to,
        );

        this.pHash = generatePHash(payload.payload);

        // const sHash = Ox(generateSHash(this.selector));

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
                    throw withCode(
                        new Error(`RenVM shard not selected.`),
                        RenJSError.INTERNAL_ERROR,
                    );
                }

                // Convert nonce to Buffer (using `0` if no nonce is set.)
                const nonce =
                    typeof this.params.nonce === "string"
                        ? fromBase64(this.params.nonce)
                        : toNBytes(this.params.nonce || 0, 32);

                const gHash = generateGHash(
                    this.pHash,
                    sHash,
                    payload.toBytes,
                    nonce,
                );
                this.gHash = gHash;
                this.gPubKey = fromBase64(this.params.shard.gPubKey);
                this._config.logger.debug("gPubKey:", Ox(this.gPubKey));

                if (!this.gPubKey || this.gPubKey.length === 0) {
                    throw withCode(
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
                        this.gPubKey,
                        gHash,
                    );
                this._gatewayAddress = gatewayAddress;
                this._config.logger.debug(
                    "gateway address:",
                    this.gatewayAddress,
                );

                // if (this.renVM.submitGatewayDetails) {
                //     const promise = this.renVM.submitGatewayDetails(
                //         this.params.this.fromChain(gatewayAddress),
                //         {
                //             ...(this._state as MintState & MintStatePartial),
                //             nHash: Buffer.from(
                //                 "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
                //                 "base64",
                //             ),
                //             payload: fromHex(encodedParameters),
                //             nonce: fromHex(nonce),
                //             to: strip0x(sendTo),
                //             // tags,
                //         },
                //         5,
                //     );
                //     if ((promise as { catch?: unknown }).catch) {
                //         (promise as Promise<unknown>).catch(console.error);
                //     }
                // }

                // eslint-disable-next-line @typescript-eslint/no-explicit-any
            } catch (error: any) {
                throw error;
            }

            this.fees = await estimateTransactionFee(
                this.provider,
                asset,
                this.fromChain,
                this.toChain,
            );

            // Will fetch deposits as long as there's at least one subscription.
            this.wait().catch(console.error);
        }

        if (isContractChain(this.fromChain)) {
            const processInput = (input: InputChainTransaction) => {
                const nonce = input.nonce!;
                const gHash = generateGHash(
                    payload.payload,
                    sHash,
                    payload.toBytes,
                    fromBase64(nonce),
                );
                this.gHash = gHash;
                this.gPubKey = Buffer.from([]);
                this._config.logger.debug("gPubKey:", Ox(this.gPubKey));

                if (!gHash || gHash.length === 0) {
                    throw withCode(
                        new Error(
                            "Invalid gateway hash being passed to gateway address generation.",
                        ),
                        RenJSError.PARAMETER_ERROR,
                    );
                }

                if (!asset || asset.length === 0) {
                    throw withCode(
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
                asset,
                from,
                () => ({
                    toChain: to.chain,
                    toPayload: payload,
                    gatewayAddress: this._gatewayAddress,
                }),
                await this.provider.getConfirmationTarget(this.fromChain.chain),
                processInput,
                removeInput,
            );
        }

        if (isContractChain(this.fromChain) && this.fromChain.getInputSetup) {
            this.setup = {
                ...this.setup,
                ...(await this.fromChain.getInputSetup(
                    asset,
                    this.inputType,
                    from,
                )),
            };
        }

        if (isContractChain(this.toChain) && this.toChain.getOutputSetup) {
            this.setup = {
                ...this.setup,
                ...(await this.toChain.getOutputSetup(
                    asset,
                    this.outputType,
                    to,
                )),
            };
        }

        return this;
    };

    public confirmationTarget = async () => {
        if (isDefined(this.targetConfirmations)) {
            return this.targetConfirmations;
        }

        this.targetConfirmations = await this.provider.getConfirmationTarget(
            this.fromChain.chain,
        );

        return this.targetConfirmations;
    };

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
    public processDeposit = async (
        deposit: InputChainTransaction,
    ): Promise<GatewayTransaction<ToPayload>> => {
        const depositIdentifier = deposit.txid + "_" + String(deposit.txindex);
        const existingTransaction = this.transactions.get(depositIdentifier);

        // If the transaction hasn't been seen before.
        // eslint-disable-next-line @typescript-eslint/no-misused-promises
        if (!existingTransaction) {
            const createGatewayTransaction = async () => {
                if (!this.pHash || !this.gHash || !this.gPubKey) {
                    throw new Error(
                        "Gateway address must be generated before calling 'processDeposit'.",
                    );
                }

                // Determine which nonce to use - converting it to a Buffer
                // to ensure it's in a standard format before calling
                // toURLBase64 again.
                const nonce = toURLBase64(
                    // Check if the deposit has an associated nonce. This will
                    // be true for contract-based inputs.
                    deposit.nonce
                        ? fromBase64(deposit.nonce)
                        : // Check if the params have a nonce - this can be
                        // a base64 string or a number. If no nonce is set,
                        // default to `0`.
                        typeof this.params.nonce === "string"
                        ? fromBase64(this.params.nonce)
                        : toNBytes(this.params.nonce || 0, 32),
                );

                const params: TransactionParams<ToPayload> = {
                    asset: this.params.asset,
                    fromTx: deposit,
                    to: this.params.to,

                    shard: {
                        gPubKey: toURLBase64(this.gPubKey),
                    },
                    nonce,
                };

                const transaction = new GatewayTransaction<ToPayload>(
                    this.provider,
                    this.fromChain,
                    this.toChain,
                    params,
                    this.in,
                    this._config,
                );

                await transaction._initialize();

                // Check if deposit has already been submitted.
                this.emit("transaction", transaction);
                // this.deposits.set(deposit);
                this._config.logger.debug("new deposit:", deposit);

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
    };

    public addListener = <Event extends "transaction">(
        event: Event,
        listener: Event extends "transaction"
            ? // eslint-disable-next-line @typescript-eslint/no-explicit-any
              (deposit: GatewayTransaction<any>) => void
            : never,
    ): this => {
        // Emit previous deposit events.
        if (event === "transaction") {
            this.transactions.map((deposit) => {
                // Check that the transaction isn't a promise.
                // The result of promises will be emitted when they resolve.
                if ((deposit as any).then === undefined) {
                    listener(deposit as GatewayTransaction<ToPayload>);
                }
            });
        }

        super.on(event, listener);
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
    public on = <Event extends "transaction">(
        event: Event,
        listener: Event extends "transaction"
            ? (deposit: GatewayTransaction) => void
            : never,
    ): this => this.addListener(event, listener);

    // Private methods /////////////////////////////////////////////////////////

    private readonly wait = async (): Promise<void> => {
        if (!this._gatewayAddress) {
            return;
        }

        while (true) {
            const listenerCancelled = () =>
                this.listenerCount("transaction") === 0;

            try {
                // If there are no listeners, continue. TODO: Exit loop entirely
                // until a lister is added again.
                if (listenerCancelled()) {
                    await sleep(1 * SECONDS);
                    continue;
                }
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
            } catch (error: any) {
                this._config.logger.error(extractError(error));
            }

            // Change the return type of `this.processDeposit` to `void`.
            const onDeposit = (deposit: InputChainTransaction): void => {
                try {
                    // TODO: Handle error.
                    this.processDeposit(deposit).catch(console.error);
                } catch (error) {
                    this._config.logger.error(error);
                }
            };

            // TODO: Flag deposits that have been cancelled, updating their status.
            const cancelDeposit = () => {};

            if (!isDepositChain(this.fromChain)) {
                throw new Error("From chain is not a deposit chain.");
            }

            try {
                await this.fromChain.watchForDeposits(
                    this.params.asset,
                    this.params.from,
                    this.gatewayAddress(),
                    onDeposit,
                    cancelDeposit,
                    listenerCancelled,
                );
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
            } catch (error: any) {
                this._config.logger.error(extractError(error));
            }

            await sleep(this._config.networkDelay);
        }
    };
}
