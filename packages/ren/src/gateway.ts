import { RenVMProvider } from "@renproject/provider";
import {
    Chain,
    ChainTransactionProgress,
    DefaultTxWaiter,
    ErrorWithCode,
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
import { OrderedMap } from "immutable";

import { GatewayTransaction } from "./gatewayTransaction";
import { GatewayParams, TransactionParams } from "./params";
import { defaultRenJSConfig, RenJSConfig } from "./utils/config";
import { estimateTransactionFee, GatewayFees } from "./utils/fees";
import { getInputAndOutputTypes } from "./utils/inputAndOutputTypes";
import { TransactionEmitter } from "./utils/transactionEmitter";

/**
 * A Gateway allows moving funds through RenVM. Its defined by the asset being
 * moved, an origin chain and a target chain. For each of these chains, a
 * payload can be specified, allowing for more complex bridgings involving
 * contract interactions.
 *
 * A Gateway will be of one of two types - a deposit gateway, requiring users
 * to send funds to a gateway address, or a contract gateway, requiring users to
 * submit a specific transaction. For example, when moving BTC from Bitcoin
 * to Ethereum, the user will have to send BTC to a Bitcoin address (the gateway
 * address). When moving DAI from Ethereum to Polygon, the user will have to
 * submit a transaction locking the DAI on Ethereum.
 *
 * When these deposits or transactions are initiated, a GatewayTransaction
 * instance is created.
 */
export class Gateway<
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    FromPayload extends { chain: string; txConfig?: any } = any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ToPayload extends { chain: string; txConfig?: any } = any,
> {
    /**
     * The parameters passed in when creating the gateway. This can be
     * serialized and used to re-create the gateway. If the parameters passed in
     * to `renJS.gateway` didn't include a `shard` value, it will be set here.
     */
    public readonly params: GatewayParams<FromPayload, ToPayload>;

    /** The chain handler for the origin chain.  */
    public readonly fromChain: Chain;

    /** The chain handler for the target chain. */
    public readonly toChain: Chain;

    /** The RenVM provider handles communicating with the RenVM network. */
    public readonly provider: RenVMProvider;

    /** RenJS config - can be used to set a logger to be used by the gateway. */
    public readonly config: typeof defaultRenJSConfig & RenJSConfig;

    /**
     * The generated gateway address for the lock-chain.
     */
    public gatewayAddress: string | undefined;

    /**
     * A map of transactions that are required to be submitted before
     * `gateway.in` can be called.
     */
    public inSetup: { [key: string]: TxSubmitter | TxWaiter } = {};

    /** The input chain transaction - not defined for deposit gateways. */
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

    /** The event emitter that handles "transaction" events. */
    public eventEmitter: TransactionEmitter<ToPayload> =
        new TransactionEmitter<ToPayload>(() =>
            this.transactions
                // Check that the transaction isn't a promise.
                // The result of promises will be emitted when they resolve.

                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                .filter((tx) => (tx as any).then === undefined)
                .map((tx) => tx as GatewayTransaction<ToPayload>)
                .valueSeq()
                .toArray(),
        );

    // The following are set in the asynchronous "initialize" method that should
    // be called immediately after the constructor.

    private _selector: string | undefined;
    /** The RenVM contract selector. */
    public get selector(): string {
        return this._defaultGetter("_selector") || this._selector;
    }

    private _gHash: Uint8Array | undefined;
    /** The gateway hash, a hash of the payload, selector, to and nonce. */
    public get gHash(): Uint8Array {
        return this._defaultGetter("_gHash") || this._gHash;
    }

    private _pHash: Uint8Array | undefined;
    /** The payload hash, a hash of the payload. */
    public get pHash(): Uint8Array {
        return this._defaultGetter("_pHash") || this._pHash;
    }

    private _fees: GatewayFees | undefined;
    /** The RenVM and blockchain fees of the gateway. */
    public get fees(): GatewayFees {
        return this._defaultGetter("_fees") || this._fees;
    }

    private _inputType: InputType | undefined;
    /** The input type of the transaction, either a lock or a burn. */
    public get inputType(): InputType {
        return this._defaultGetter("_inputType") || this._inputType;
    }

    private _outputType: OutputType | undefined;
    /** The output type of the transaction, either a mint or a release. */
    public get outputType(): OutputType {
        return this._defaultGetter("_outputType") || this._outputType;
    }

    private _inConfirmationTarget: number | undefined;
    /** The number of confirmations required for `gateway.in`. */
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
        this.params = { ...params };
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
     * @hidden - Called automatically when calling [[RenJS.gateway]]. It has
     * been split from the constructor because it is asynchronous.
     */
    public initialize = async (): Promise<Gateway<FromPayload, ToPayload>> => {
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
            throw ErrorWithCode.updateError(
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
            throw ErrorWithCode.updateError(
                new Error(
                    `Cannot mint ${asset} to non-contract chain ${this.toChain.chain}`,
                ),
                RenJSError.PARAMETER_ERROR,
            );
        }

        const [
            fees,
            confirmationTarget,
            shard,
            payload,
            isDepositAssetOnFromChain,
        ] = await Promise.all([
            estimateTransactionFee(
                this.provider,
                asset,
                this.fromChain,
                this.toChain,
            ),
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
            isDepositChain(this.fromChain) &&
                this.fromChain.isDepositAsset(this.params.asset),
        ]);

        this._fees = fees;

        // Check if the selector is whitelisted - ie currently enabled in RenVM.
        // Run this later because the underlying queryConfig is cached by
        // `selectShard`.
        if (!(await this.provider.selectorWhitelisted(selector))) {
            throw new Error(
                `Unable to bridge ${asset} from ${from.chain} to ${to.chain}: Selector ${selector} not whitelisted.`,
            );
        }

        if (payload) {
            this._pHash = generatePHash(payload.payload);
        }

        this.params.shard = shard;
        this._inConfirmationTarget = confirmationTarget;

        // const sHash = utils.Ox(generateSHash(this.selector));

        const sHash = generateSHash(
            `${this.params.asset}/to${this.params.to.chain}`,
        );

        if (isDepositChain(this.fromChain) && isDepositAssetOnFromChain) {
            try {
                if (!isContractChain(this.toChain)) {
                    throw new Error(
                        `Cannot mint ${asset} to non-contract chain ${this.toChain.chain}.`,
                    );
                }

                if (!payload) {
                    throw new Error(`No target payload set.`);
                }

                if (!this.params.shard) {
                    throw new ErrorWithCode(
                        `RenVM shard not selected.`,
                        RenJSError.INTERNAL_ERROR,
                    );
                }

                // Convert nonce to Uint8Array (using `0` if no nonce is set.)
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
                    throw ErrorWithCode.updateError(
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
                    nHash: utils.fromBase64(
                        "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
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
            } catch (error: unknown) {
                throw ErrorWithCode.updateError(
                    error,
                    (error as ErrorWithCode).code || RenJSError.INTERNAL_ERROR,
                );
            }

            // Will fetch deposits as long as there's at least one subscription.
            this._watchForDeposits().catch(this.config.logger.error);
        }

        if (isContractChain(this.fromChain)) {
            const processInput = (input: InputChainTransaction) => {
                // TODO: Add to queue instead so that it can be retried on error.
                this.processDeposit(input).catch(this.config.logger.error);
            };

            // TODO
            const removeInput = () => {};

            let inSetup;
            [this.in, inSetup] = await Promise.all([
                this.fromChain.getInputTx(
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
                ),
                this.fromChain.getInSetup &&
                    this.fromChain.getInSetup(
                        asset,
                        this.inputType,
                        this.outputType,
                        from,
                        () => ({
                            toChain: to.chain,
                            toPayload: payload,
                            gatewayAddress: this.gatewayAddress,
                        }),
                    ),
            ]);

            if (inSetup) {
                this.inSetup = {
                    ...this.inSetup,
                    ...inSetup,
                };
            }
        }

        return this;
    };

    private addTransaction = async (
        identifier: string,
        tx:
            | GatewayTransaction<ToPayload>
            | Promise<GatewayTransaction<ToPayload>>,
    ) => {
        // FIXME: Temporary work-around for data race.
        await utils.sleep(0);
        this.transactions = this.transactions.set(identifier, tx);
    };

    private removeTransaction = async (identifier: string) => {
        // FIXME: Temporary work-around for data race.
        await utils.sleep(0);
        this.transactions = this.transactions.remove(identifier);
    };

    /**
     * `processDeposit` allows you to manually provide the details of a deposit
     * and returns a [[GatewayTransaction]] object.
     *
     * @param inputTx The deposit details in the format defined by the
     * LockChain. This should be the same format as `deposit.depositDetails` for
     * a deposit returned from `.on("transaction", ...)`.
     *
     * ```ts
     * const gatewayTransaction = await gateway
     *   .processDeposit({
     *      chain: "Ethereum",
     *      txHash: "0xef90...",
     *      txid: "752...",
     *      txindex: "0",
     *      amount: "1",
     *   })
     * ```
     * @category Main
     */
    public processDeposit = async (
        inputTx: InputChainTransaction,
    ): Promise<GatewayTransaction<ToPayload>> => {
        const depositIdentifier = `${String(inputTx.txid)}_${String(
            inputTx.txindex,
        )}`;
        const existingTransaction = this.transactions.get(depositIdentifier);

        // If the transaction hasn't been seen before.
        // eslint-disable-next-line @typescript-eslint/no-misused-promises
        if (!existingTransaction) {
            const createGatewayTransaction = async () => {
                if (!utils.isDefined(this.inConfirmationTarget)) {
                    throw new Error(
                        "Gateway address must be generated before calling 'processDeposit'.",
                    );
                }

                // Determine which nonce to use - converting it to a Uint8Array
                // to ensure it's in a standard format before calling
                // utils.toURLBase64 again.
                const nonce = utils.toURLBase64(
                    // Check if the deposit has an associated nonce. This will
                    // be true for contract-based inputs.
                    inputTx.nonce
                        ? utils.fromBase64(inputTx.nonce)
                        : // Check if the params have a nonce - this can be
                        // a base64 string or a number. If no nonce is set,
                        // default to `0`.
                        typeof this.params.nonce === "string"
                        ? utils.fromBase64(this.params.nonce)
                        : utils.toNBytes(this.params.nonce || 0, 32),
                );

                const params: TransactionParams<ToPayload> = {
                    asset: this.params.asset,
                    fromTx: inputTx,
                    to: this.params.to,

                    shard: this.params.shard,
                    nonce,
                };

                // Check if `this.in` can be re-used or if a new DefaultTxWaiter
                // should be created.
                let inTx = this.in;
                if (
                    // No inTx.
                    !inTx ||
                    // inTx is for another transaction.
                    (inTx.progress.transaction &&
                        (inTx.progress.transaction.txHash !== inputTx.txHash ||
                            inTx.progress.transaction.txindex !==
                                inputTx.txindex))
                ) {
                    inTx = new DefaultTxWaiter({
                        chainTransaction: inputTx,
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

                this.eventEmitter.emit("transaction", transaction);
                // this.deposits.set(deposit);
                this.config.logger.debug("new deposit:", inputTx);

                return transaction;
            };

            const promise = createGatewayTransaction();

            await this.addTransaction(depositIdentifier, promise);

            try {
                await this.addTransaction(depositIdentifier, await promise);
            } catch (error: unknown) {
                await this.removeTransaction(depositIdentifier);
                const message = `Error processing deposit ${
                    inputTx.txHash
                }: ${utils.extractError(error)}`;
                if (error instanceof Error) {
                    error.message = message;
                } else {
                    error = new Error(message);
                }
                throw error;
            }
        }
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
        return (await existingTransaction) as GatewayTransaction<ToPayload>;
    };

    /**
     * Listen to "transaction" events, registering a callback that will be
     * called for all previous transactions and for any future transaction.
     *
     * To remove the listener, call `gateway.eventEmitter.removeListener` or
     * `gateway.eventEmitter.removeAllListeners`.
     */
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

    private _defaultGetter = (name: string) => {
        if (this[name] === undefined) {
            throw new Error(
                `Must call 'initialize' before accessing '${name}'.`,
            );
        }
        return this[name];
    };

    /**
     * Internal method that fetches deposits to the gateway address. If there
     * are no listeners to the "transaction" event, then it pauses fetching
     * deposits.
     */
    private _watchForDeposits = async (): Promise<void> => {
        if (
            !this.gatewayAddress ||
            !isDepositChain(this.fromChain) ||
            !this.fromChain.watchForDeposits
        ) {
            return;
        }

        while (true) {
            try {
                const listenerCancelled = () =>
                    this.eventEmitter.listenerCount("transaction") === 0;

                // Change the return type of `this.processDeposit` to `void`.
                const onDeposit = (deposit: InputChainTransaction): void => {
                    try {
                        // TODO: Handle error.
                        this.processDeposit(deposit).catch(
                            this.config.logger.error,
                        );
                    } catch (error: unknown) {
                        this.config.logger.error(error);
                    }
                };

                // TODO: Flag deposits that have been cancelled, updating their status.
                const cancelDeposit = () => {};

                // If there are no listeners, continue. TODO: Exit loop entirely
                // until a lister is added again.
                if (listenerCancelled()) {
                    await utils.sleep(1 * utils.sleep.SECONDS);
                    continue;
                }

                await this.fromChain.watchForDeposits(
                    this.params.asset,
                    this.params.from,
                    this.gatewayAddress,
                    onDeposit,
                    cancelDeposit,
                    listenerCancelled,
                );
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
            } catch (error: unknown) {
                this.config.logger.error(utils.extractError(error));
            }

            await utils.sleep(this.config.networkDelay);
        }
    };
}
