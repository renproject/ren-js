import { EventEmitter } from "events";
import { OrderedMap } from "immutable";

import { RenVMProvider } from "@renproject/provider";
import {
    Chain,
    extractError,
    fromBase64,
    fromHex,
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
    public gatewayAddress = () => {
        if (!this._gatewayAddress) {
            throw new Error("Not initialized.");
        }
        return this._gatewayAddress;
    };

    /** The parameters passed in when creating the LockAndMint. */
    public params: GatewayParams<FromPayload, ToPayload> & {
        fromChain: Chain;
        toChain: Chain;
    };

    /** See [[RenJS.renVM]]. */
    public renVM: RenVMProvider;

    public selector: string = "";

    public _config: typeof defaultRenJSConfig & RenJSConfig;

    /**
     * Deposits represents the lock deposits that have been detected so far.
     */
    private deposits: OrderedMap<string, GatewayTransaction<ToPayload>> =
        OrderedMap<string, GatewayTransaction<ToPayload>>();

    private targetConfirmations: number | undefined;
    public gPubKey: Buffer | undefined;
    public gHash: Buffer | undefined;
    public pHash: Buffer | undefined;

    public in: TxSubmitter | TxWaiter | undefined;

    public setup: { [key: string]: TxSubmitter | TxWaiter } = {};

    private inputType: InputType;
    private outputType: OutputType;

    /**
     * @hidden - should be created using [[RenJS.lockAndMint]] instead.
     */
    constructor(
        renVM: RenVMProvider,
        params: GatewayParams<FromPayload, ToPayload> & {
            fromChain: Chain;
            toChain: Chain;
        },
        config: RenJSConfig = {},
    ) {
        super();

        this.params = params;
        this.renVM = renVM;

        this._config = {
            ...defaultRenJSConfig,
            ...config,
        };

        // Set in async constructor, `_initialize`.
        this.inputType = undefined as never;
        this.outputType = undefined as never;

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
        const { to, asset, from, fromChain, toChain, nonce } = this.params;

        const { inputType, outputType, selector } =
            await getInputAndOutputTypes(this.params);
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
            !isContractChain(fromChain)
        ) {
            throw withCode(
                new Error(
                    `Cannot release from non-contract chain ${fromChain.chain}`,
                ),
                RenJSError.INVALID_PARAMETERS,
            );
        }

        if (this.outputType === OutputType.Mint && !isContractChain(toChain)) {
            throw withCode(
                new Error(`Cannot mint to non-contract chain ${toChain.chain}`),
                RenJSError.INVALID_PARAMETERS,
            );
        }

        const payload = await toChain.getOutputPayload(
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
            isDepositChain(fromChain) &&
            (await fromChain.isDepositAsset(this.params.asset))
        ) {
            try {
                if (!isContractChain(toChain)) {
                    throw new Error(
                        `Cannot mint to non-contract chain ${toChain.chain}.`,
                    );
                }

                const nonceBuffer = nonce
                    ? Buffer.isBuffer(nonce)
                        ? nonce
                        : fromBase64(nonce)
                    : toNBytes(0, 32);

                const gHash = generateGHash(
                    this.pHash,
                    sHash,
                    fromHex(payload.to),
                    nonceBuffer,
                );
                this.gHash = gHash;
                this.gPubKey =
                    this._config.gPubKey && this._config.gPubKey.length > 0
                        ? this._config.gPubKey
                        : await this.renVM.selectPublicKey(asset);
                this._config.logger.debug("gPubKey:", Ox(this.gPubKey));

                if (!this.gPubKey || this.gPubKey.length === 0) {
                    throw new Error("Unable to fetch RenVM shard public key.");
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

                const gatewayAddress = await fromChain.createGatewayAddress(
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
                //         this.params.fromChain(gatewayAddress),
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

            // Will fetch deposits as long as there's at least one deposit.
            this.wait().catch(console.error);
        }

        if (isContractChain(fromChain)) {
            if (!isContractChain(toChain)) {
                throw new Error(
                    `Cannot mint to non-contract chain ${toChain.chain}.`,
                );
            }

            const processInput = (lock: InputChainTransaction) => {
                const nonce = lock.nonce!;
                const gHash = generateGHash(
                    payload.payload,
                    sHash,
                    fromHex(payload.to),
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
                        RenJSError.INVALID_PARAMETERS,
                    );
                }

                if (!asset || asset.length === 0) {
                    throw withCode(
                        new Error(
                            "Invalid asset being passed to gateway address generation.",
                        ),
                        RenJSError.INVALID_PARAMETERS,
                    );
                }

                // TODO: Add to queue instead so that it can be retried on error.
                this.processDeposit(lock).catch(console.error);
            };

            // TODO
            const removeInput = () => {};

            this.in = await fromChain.getInputTx(
                this.inputType,
                asset,
                from,
                {
                    toChain: to.chain,
                    toPayload: payload,
                    gatewayAddress: this._gatewayAddress,
                },
                await this.renVM.getConfirmationTarget(
                    this.params.fromChain.chain,
                ),
                processInput,
                removeInput,
            );
        }

        if (isContractChain(fromChain) && fromChain.getInputSetup) {
            this.setup = {
                ...this.setup,
                ...(await fromChain.getInputSetup(asset, this.inputType, from)),
            };
        }

        if (isContractChain(toChain) && toChain.getOutputSetup) {
            this.setup = {
                ...this.setup,
                ...(await toChain.getOutputSetup(asset, this.outputType, to)),
            };
        }

        return this;
    };

    public confirmationTarget = async () => {
        if (isDefined(this.targetConfirmations)) {
            return this.targetConfirmations;
        }

        this.targetConfirmations = await this.renVM.getConfirmationTarget(
            this.params.fromChain.chain,
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
     *
     * @category Main
     */
    public processDeposit = async (
        deposit: InputChainTransaction,
    ): Promise<GatewayTransaction<ToPayload>> => {
        if (!this.pHash || !this.gHash || !this.gPubKey) {
            throw new Error(
                "Gateway address must be generated before calling 'processDeposit'.",
            );
        }

        const depositIdentifier = deposit.txid + "_" + String(deposit.txindex);
        let depositObject = this.deposits.get(depositIdentifier);

        const nonce = deposit.nonce
            ? fromBase64(deposit.nonce)
            : this.params.nonce
            ? Buffer.isBuffer(this.params.nonce)
                ? this.params.nonce
                : fromHex(this.params.nonce)
            : toNBytes(0, 32);

        const params: TransactionParams<ToPayload> = {
            asset: this.params.asset,
            fromTx: deposit,
            to: this.params.to,

            gPubKey: toURLBase64(this.gPubKey),
            nonce: toURLBase64(nonce),
        };

        // If the transaction hasn't been seen before.
        if (!depositObject) {
            depositObject = new GatewayTransaction<ToPayload>(
                this.renVM,
                this.params.fromChain,
                this.params.toChain,
                params,
                this.in,
                this._config,
            );

            this.deposits = this.deposits.set(depositIdentifier, depositObject);

            await depositObject._initialize();

            // Check if deposit has already been submitted.
            this.emit("transaction", depositObject);
            // this.deposits.set(deposit);
            this._config.logger.debug("new deposit:", deposit);
            this.deposits = this.deposits.set(depositIdentifier, depositObject);
        }
        return depositObject;
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
            this.deposits.map((deposit) => {
                listener(deposit);
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

            const { fromChain } = this.params;

            if (!isDepositChain(fromChain)) {
                throw new Error("From chain is not a deposit chain.");
            }

            try {
                await fromChain.watchForDeposits(
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
