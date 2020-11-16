import {
    AbiItem,
    DepositCommon,
    getRenNetworkDetails,
    LockAndMintParams,
    LockAndMintTransaction,
    Logger,
    newPromiEvent,
    NullLogger,
    PromiEvent,
    RenNetworkDetails,
    TxStatus,
} from "@renproject/interfaces";
import { AbstractRenVMProvider } from "@renproject/rpc";
import {
    assertObject,
    assertType,
    emptyNonce,
    extractError,
    fromBase64,
    fromHex,
    generateGHash,
    generateNHash,
    generatePHash,
    generateSHash,
    overrideContractCalls,
    Ox,
    payloadToMintABI,
    renVMHashToBase64,
    SECONDS,
    sleep,
    strip0x,
    toBase64,
    toURLBase64,
} from "@renproject/utils";
import { EventEmitter } from "events";
import { OrderedMap } from "immutable";
import { AbiCoder } from "web3-eth-abi";

interface MintState {
    logger: Logger;
    selector: string;
}

interface MintStatePartial {
    renNetwork: RenNetworkDetails;
    gPubKey: Buffer;
    gHash: Buffer;
    pHash: Buffer;
    targetConfirmations: number | undefined;
    queryTxResult?: LockAndMintTransaction;
}

interface DepositState {
    gHash: Buffer;
    gPubKey: Buffer;
    nHash: Buffer;
    nonce: Buffer;
    output: { txindex: string; txid: Buffer };
    amount: string;
    payload: Buffer;
    pHash: Buffer;
    to: string;
    fn: string;
    token?: string;
    fnABI: AbiItem[];
    tags: [] | [string];
    txHash: string;
}

/**
 * A `LockAndMint` object tied to a particular gateway address. LockAndMint
 * should not be created directly. Instead, [[RenJS.lockAndMint]] will create a
 * `LockAndMint` object.
 *
 * `LockAndMint` extends the EventEmitter class, and emits a `"deposit"` event
 * for each new deposit that is observed. Deposits will only be watched for if
 * there is an active listener for the `"deposit"` event.
 *
 * A LockAndMint object watches transactions to the [[gatewayAddress]] on the
 * lock-chain.
 *
 * Deposits to the gateway address can be listened to with the `"deposit"`
 * event using [[on]], which will return [[LockAndMintDeposit]] instances.
 *
 * ```ts
 * console.log(`Deposit to ${JSON.stringify(lockAndMint.gatewayAddress)}`);
 *
 * lockAndMint.on("deposit", async (deposit) => {
 *    console.log(`Received deposit`, deposit);
 *    await RenJS.defaultDepositHandler(deposit);
 * });
 * ```
 *
 * @noInheritDoc
 */
export class LockAndMint<
    /**
     * @hidden
     */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    LockTransaction = any,
    LockDeposit extends DepositCommon<LockTransaction> = DepositCommon<
        LockTransaction
    >,
    LockAddress = string,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    MintTransaction = any,
    MintAddress = string
> extends EventEmitter {
    // Public

    /**
     * The generated gateway address for the lock-chain. For chains such as BTC
     * this is a string. For other chains, this may be an object, so the method
     * of showing this address to users should be implemented on a
     * chain-by-chain basis.
     */
    public gatewayAddress: LockAddress | undefined;

    /** The parameters passed in when creating the LockAndMint. */
    public params: LockAndMintParams<
        LockTransaction,
        LockDeposit,
        LockAddress,
        MintTransaction,
        MintAddress
    >;

    /** See [[RenJS.renVM]]. */
    public renVM: AbstractRenVMProvider;

    /**
     * Internal state of the mint object, including the `gHash` and `pHash`.
     * Interface may change across minor and patch releases.
     */
    public _state: MintState & Partial<MintStatePartial>;

    /**
     * Deposits represents the lock deposits that have been so far.
     */
    private deposits: OrderedMap<
        string,
        LockAndMintDeposit<
            LockTransaction,
            LockDeposit,
            LockAddress,
            MintTransaction,
            MintAddress
        >
    > = OrderedMap();
    private readonly getDepositsInstance: number;

    /**
     * @hidden - should be created using [[RenJS.lockAndMint]] instead.
     */
    constructor(
        renVM: AbstractRenVMProvider,
        params: LockAndMintParams<
            LockTransaction,
            LockDeposit,
            LockAddress,
            MintTransaction,
            MintAddress
        >,
        logger: Logger = NullLogger,
    ) {
        super();

        this.params = params;
        this.renVM = renVM;
        this._state = {
            logger,
            selector: this.renVM.selector(this.params),
        };

        this.getDepositsInstance = Math.random();

        const txHash = this.params.txHash;

        // Decode nonce or use empty nonce 0x0.
        const nonce = this.params.nonce
            ? fromHex(this.params.nonce)
            : emptyNonce();
        this.params.nonce = nonce;

        if (!txHash) {
            this.params.nonce = nonce;
        }

        {
            // Debug log
            const { to: _to, from: _from, ...restOfParams } = this.params;
            this._state.logger.debug("lockAndMint created:", restOfParams);
        }
    }

    /**
     * @hidden - Called automatically when calling [[RenJS.lockAndMint]]. It has
     * been split from the constructor because it's asynchronous.
     */
    public readonly _initialize = async (): Promise<
        LockAndMint<
            LockTransaction,
            LockDeposit,
            LockAddress,
            MintTransaction,
            MintAddress
        >
    > => {
        this._state.renNetwork =
            this._state.renNetwork ||
            getRenNetworkDetails(
                await this.renVM.getNetwork(this._state.selector),
            );

        if (!this.params.from.renNetwork) {
            await this.params.from.initialize(this._state.renNetwork);
        }
        if (!this.params.to.renNetwork) {
            await this.params.to.initialize(this._state.renNetwork);
        }

        const overwriteParams =
            this.params.to.getMintParams &&
            (await this.params.to.getMintParams(this.params.asset));

        this.params = {
            ...overwriteParams,
            ...this.params,
        };

        try {
            this.gatewayAddress = await this.generateGatewayAddress();
        } catch (error) {
            throw error;
        }

        // Will fetch deposits as long as there's at least one deposit.
        this.wait().catch(console.error);

        try {
            if (this.renVM.getConfirmationTarget) {
                this._state.targetConfirmations = await this.renVM.getConfirmationTarget(
                    this._state.selector,
                    this.params.from,
                );
            }
        } catch (error) {
            // Ignore error.
        }

        return this;
    };

    /**
     * `processDeposit` allows you to manually provide the details of a deposit
     * and returns a [[LockAndMintDeposit]] object.
     *
     * @param deposit The deposit details in the format defined by the
     * LockChain. This should be the same format as `deposit.depositDetails` for
     * a deposit returned from `.on("deposit", ...)`.
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
        deposit: LockDeposit,
    ): Promise<
        LockAndMintDeposit<
            LockTransaction,
            LockDeposit,
            LockAddress,
            MintTransaction,
            MintAddress
        >
    > => {
        if (
            !this._state.renNetwork ||
            !this._state.pHash ||
            !this._state.gHash ||
            !this._state.gPubKey ||
            !this.gatewayAddress
        ) {
            throw new Error(
                "Gateway address must be generated before calling 'wait'.",
            );
        }

        const depositID = this.params.from.transactionID(deposit.transaction);
        let depositObject = this.deposits.get(depositID);

        // If the confidence has increased.
        if (
            !depositObject
            // || (existingConfidenceRatio !== undefined &&
            // confidenceRatio > existingConfidenceRatio)
        ) {
            depositObject = new LockAndMintDeposit<
                LockTransaction,
                LockDeposit,
                LockAddress,
                MintTransaction,
                MintAddress
            >(deposit, this.params, this.renVM, {
                ...this._state,
                renNetwork: this._state.renNetwork,
                pHash: this._state.pHash,
                gHash: this._state.gHash,
                gPubKey: this._state.gPubKey,
                targetConfirmations:
                    this._state.targetConfirmations || undefined,
            });

            await depositObject._initialize();

            // Check if deposit has already been submitted.
            if (depositObject.status !== DepositStatus.Submitted) {
                this.emit("deposit", depositObject);
                // this.deposits.set(deposit);
                this._state.logger.debug("new deposit:", deposit);
                this.deposits = this.deposits.set(depositID, depositObject);
            }
        }
        return depositObject;
    };

    public addListener = <Event extends "deposit">(
        event: Event,
        listener: Event extends "deposit"
            ? (
                  deposit: LockAndMintDeposit<
                      LockTransaction,
                      LockDeposit,
                      LockAddress,
                      MintTransaction,
                      MintAddress
                  >,
              ) => void
            : never,
    ): this => {
        // Emit previous deposit events.
        if (event === "deposit") {
            this.deposits.map((deposit) => {
                listener(deposit);
            });
        }

        super.on(event, listener);
        return this;
    };

    /**
     * `on` creates a new listener to `"deposit"` events, returning
     * [[LockAndMintDeposit]] instances.
     *
     * `on` extends `EventEmitter.on`, modifying it to immediately return all
     * previous `"deposit"` events, in addition to new events, when a new
     * listener is created.
     *
     * @category Main
     */
    public on = <Event extends "deposit">(
        event: Event,
        listener: Event extends "deposit"
            ? (
                  deposit: LockAndMintDeposit<
                      LockTransaction,
                      LockDeposit,
                      LockAddress,
                      MintTransaction,
                      MintAddress
                  >,
              ) => void
            : never,
    ): this => this.addListener(event, listener);

    // Private methods /////////////////////////////////////////////////////////

    private readonly generateGatewayAddress = async (): Promise<
        LockAddress
    > => {
        if (this.gatewayAddress) {
            return this.gatewayAddress;
        }

        const { nonce, contractCalls } = this.params;

        if (!nonce) {
            throw new Error(
                `Must call 'initialize' before calling 'generateGatewayAddress'.`,
            );
        }

        if (!contractCalls) {
            throw new Error(`Must provide contract call details.`);
        }

        // Last contract call
        const { contractParams, sendTo } = contractCalls[
            contractCalls.length - 1
        ];

        const tokenGatewayContract =
            this.renVM.version(this._state.selector) >= 2
                ? Ox(generateSHash(this._state.selector))
                : await this.params.to.resolveTokenGatewayContract(
                      this.params.asset,
                  );

        this._state.pHash = generatePHash(
            contractParams || [],
            this._state.logger,
        );

        const gHash = generateGHash(
            contractParams || [],
            sendTo,
            tokenGatewayContract,
            fromHex(nonce),
            this.renVM.version(this._state.selector) >= 2,
            this._state.logger,
        );
        this._state.gHash = gHash;
        this._state.gPubKey = await this.renVM.selectPublicKey(
            this._state.selector,
            this.renVM.version(this._state.selector) >= 2
                ? this.params.from.name
                : this.params.asset,
        );
        this._state.logger.debug("gPubKey:", Ox(this._state.gPubKey));

        const gatewayAddress = await this.params.from.getGatewayAddress(
            this.params.asset,
            this._state.gPubKey,
            gHash,
        );
        this.gatewayAddress = gatewayAddress;
        this._state.logger.debug("gateway address:", this.gatewayAddress);

        return this.gatewayAddress;
    };

    private readonly wait = async (): Promise<never> => {
        if (
            !this._state.pHash ||
            !this._state.gHash ||
            !this._state.gPubKey ||
            !this.gatewayAddress
        ) {
            throw new Error(
                "Gateway address must be generated before calling 'wait'.",
            );
        }

        while (true) {
            const listenerCancelled = () => this.listenerCount("deposit") === 0;

            try {
                // If there are no listeners, continue.
                if (listenerCancelled()) {
                    await sleep(1 * SECONDS);
                    continue;
                }
            } catch (error) {
                this._state.logger.error(extractError(error));
            }

            // Change the return type of `this.processDeposit` to `void`.
            const onDeposit = async (deposit: LockDeposit): Promise<void> => {
                await this.processDeposit(deposit);
            };

            // TODO: Flag deposits that have been cancelled, updating their status.
            const cancelDeposit = async () => Promise.resolve();

            try {
                await this.params.from.getDeposits(
                    this.params.asset,
                    this.gatewayAddress,
                    this.getDepositsInstance,
                    onDeposit,
                    cancelDeposit,
                    listenerCancelled,
                );
            } catch (error) {
                this._state.logger.error(extractError(error));
            }

            await sleep(15 * SECONDS);
        }
    };
}

export enum DepositStatus {
    Detected = "detected",
    Confirmed = "confirmed",
    Signed = "signed",
    Submitted = "submitted",
}

/**
 * A LockAndMintDeposit represents a deposit that has been made to a gateway
 * address.
 *
 * Once it has been detected, the steps required to complete the mint are:
 * 1. Wait for the transaction to be mined. The number of confirmations here
 * depends on the asset.
 * 2. Submit the deposit to RenVM and wait for a signature.
 * 3. Submit the deposit to the lock-chain.
 *
 * Each of these steps can be performed using their respective methods. Each
 * of these return a PromiEvent, meaning that in addition to being a promise,
 * they also emit events that can be listened to.
 *
 * ```ts
 * await deposit.confirmed();
 * await deposit.signed();
 * await deposit.mint();
 * ```
 */
export class LockAndMintDeposit<
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    LockTransaction = any,
    LockDeposit extends DepositCommon<LockTransaction> = DepositCommon<
        LockTransaction
    >,
    LockAddress = string,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    MintTransaction = any,
    MintAddress = string
> {
    /** The details, including amount, of the deposit. */
    public depositDetails: LockDeposit;

    /** The parameters passed in when calling [[RenJS.lockAndMint]]. */
    public params: LockAndMintParams<
        LockTransaction,
        LockDeposit,
        LockAddress,
        MintTransaction,
        MintAddress
    >;

    /**
     * The status of the deposit, updated automatically. You can also call
     * `refreshStatus` to re-fetch this.
     *
     * ```ts
     * deposit.status;
     * // > "signed"
     * ```
     */
    public status: DepositStatus;

    /** See [[RenJS.renVM]]. */
    public renVM: AbstractRenVMProvider;

    /**
     * Internal state of the mint object, including the `gHash` and `pHash`.
     * Interface may change across minor and patch releases.
     */
    public _state: MintState & MintStatePartial & DepositState;

    /** @hidden */
    constructor(
        depositDetails: LockDeposit,
        params: LockAndMintParams<
            LockTransaction,
            LockDeposit,
            LockAddress,
            MintTransaction,
            MintAddress
        >,
        renVM: AbstractRenVMProvider,
        state: MintState & MintStatePartial,
    ) {
        assertObject(
            {
                transaction: "any",
                amount: "string",
            },
            {
                depositDetails: depositDetails as DepositCommon<
                    LockTransaction
                >,
            },
        );
        assertObject(
            {
                selector: "string",
                logger: "object",
                renNetwork: "object",
                gPubKey: "Buffer",
                gHash: "Buffer",
                pHash: "Buffer",
                targetConfirmations: "number | undefined",
                queryTxResult: "object | undefined",
            },
            { state },
        );

        this.depositDetails = depositDetails;
        this.params = params;
        this.renVM = renVM;
        // this._state = state;

        // `processDeposit` will call `refreshStatus` which will set the proper
        // status.
        this.status = DepositStatus.Detected;

        const { txHash, contractCalls, nonce } = this.params;

        if (!nonce) {
            throw new Error(`No nonce passed in to LockAndMintDeposit.`);
        }

        if (!txHash && (!contractCalls || !contractCalls.length)) {
            throw new Error(
                `Must provide Ren transaction hash or contract call details.`,
            );
        }

        this.validateParams();

        const deposit = this.depositDetails;
        const providedTxHash = this.params.txHash
            ? renVMHashToBase64(
                  this.params.txHash,
                  this.renVM.version(state.selector) >= 2,
              )
            : undefined;

        if (!nonce) {
            throw new Error("Unable to submit to RenVM without nonce.");
        }

        if (!contractCalls || !contractCalls.length) {
            throw new Error(
                `Unable to submit to RenVM without contract call details.`,
            );
        }

        // Last contract call
        const { contractParams, sendTo, contractFn } = contractCalls[
            contractCalls.length - 1
        ];

        const filteredContractParams = contractParams
            ? contractParams.filter(
                  (contractParam) => !contractParam.notInPayload,
              )
            : contractParams;

        const encodedParameters = new AbiCoder().encodeParameters(
            (filteredContractParams || []).map((i) => i.type),
            (filteredContractParams || []).map((i) => i.value),
        );

        if (this.params.tags && this.params.tags.length > 1) {
            throw new Error("Providing multiple tags is not supported yet.");
        }

        const { pHash } = state;

        const transactionDetails = this.params.from.transactionRPCFormat(
            this.depositDetails.transaction,
            renVM.version(state.selector) >= 2,
        );

        const nHash = generateNHash(
            fromHex(nonce),
            transactionDetails.txid,
            transactionDetails.txindex,
            renVM.version(state.selector) >= 2,
        );

        const outputHashFormat =
            renVM.version(state.selector) >= 2
                ? ""
                : this.params.from.depositV1HashString(deposit);

        const fnABI = payloadToMintABI(
            contractFn,
            filteredContractParams || [],
        );

        const tags: [string] | [] =
            this.params.tags && this.params.tags.length
                ? [this.params.tags[0]]
                : [];

        this._state = {
            ...state,
            // gHash
            // gPubKey
            nHash,
            nonce: fromHex(nonce),
            output: this.params.from.transactionRPCFormat(
                deposit.transaction,
                renVM.version(state.selector) >= 2, // v2
            ),
            amount: deposit.amount,
            payload: fromHex(encodedParameters),
            pHash,
            to:
                renVM.version(state.selector) >= 2
                    ? strip0x(sendTo)
                    : Ox(sendTo),
            fn: contractFn,
            fnABI,
            tags,
            // Will be set in the next statement.
            txHash: "",
        };

        this._state.txHash = (renVM.version(this._state.selector) >= 2
            ? toURLBase64
            : toBase64)(
            this.renVM.mintTxHash({
                ...this._state,
                outputHashFormat,
            }),
        );

        if (
            providedTxHash &&
            !fromBase64(providedTxHash).equals(fromBase64(this.txHash()))
        ) {
            throw new Error(
                `Inconsistent RenVM transaction hash: got ${providedTxHash} but expected ${this.txHash()}.`,
            );
        }

        {
            // Debug log
            const { to: _to, from: _from, ...restOfParams } = this.params;
            this._state.logger.debug("lockAndMint created", restOfParams);
        }
    }

    /** @hidden */
    public readonly _initialize = async (): Promise<this> => {
        await this.refreshStatus();

        this._state.token = await this.params.to.resolveTokenGatewayContract(
            this.params.asset,
        );

        return this;
    };

    /**
     * `txHash` returns the RenVM transaction hash, which is distinct from the
     * lock or mint chain transaction hashes. It can be used to query the
     * lock-and-mint details from RenVM  once they've been submitted to it.
     *
     * The RenVM txHash is a URL-base64 string.
     *
     * ```ts
     * deposit.txHash();
     * // > "QNM87rNDuxx54H7VK7D_NAU0u_mjk09-G25IJZL1QrI"
     * ```
     */
    public txHash = (): string => {
        // The type of `txHash` is a function instead of a string to match the
        // interface of BurnAndRelease.
        return this._state.txHash;
    };

    /**
     * `queryTx` fetches the RenVM transaction details of the deposit.
     *
     * ```ts
     * await deposit.queryTx();
     * // > { to: "...", hash: "...", status: "done", in: {...}, out: {...} }
     */
    public queryTx = async (): Promise<LockAndMintTransaction> => {
        const mintTransaction: LockAndMintTransaction = await this.renVM.queryMintOrBurn(
            this._state.selector,
            fromBase64(this.txHash()),
        );
        this._state.queryTxResult = mintTransaction;
        return mintTransaction;
    };

    /**
     * `refreshStatus` fetches the deposit's status on the mint-chain, RenVM
     * and lock-chain to calculate it's [[DepositStatus]].
     *
     * ```ts
     * await deposit.refreshStatus();
     * // > "signed"
     * ```
     */
    public refreshStatus = async (): Promise<DepositStatus> => {
        const status = await (async () => {
            let queryTxResult;

            // Fetch sighash.
            if (this.renVM.version(this._state.selector) === 1) {
                try {
                    queryTxResult = await this.queryTx();
                } catch (_error) {
                    // Ignore error.
                }
            }

            try {
                const transactionFound = await this.findTransaction();
                if (transactionFound) {
                    return DepositStatus.Submitted;
                }
            } catch (_error) {
                // Ignore error.
            }

            try {
                queryTxResult = queryTxResult || (await this.queryTx());
                if (
                    queryTxResult &&
                    queryTxResult.txStatus === TxStatus.TxStatusDone
                ) {
                    return DepositStatus.Signed;
                }
            } catch (_error) {
                // Ignore error.
            }

            try {
                const confirmations = await this.confirmations();
                if (confirmations.current >= confirmations.target) {
                    return DepositStatus.Confirmed;
                }
            } catch (_error) {
                // Ignore error.
            }

            return DepositStatus.Detected;
        })();
        this.status = status;
        return status;
    };

    /**
     * `confirmations` returns the deposit's current and target number of
     * confirmations on the lock-chain.
     *
     * ```ts
     * await deposit
     *  .confirmations();
     * // > { current: 4, target: 6 }
     * ```
     */
    public confirmations = async (): Promise<{
        current: number;
        target: number;
    }> => {
        const {
            current,
            target,
        } = await this.params.from.transactionConfidence(
            this.depositDetails.transaction,
        );
        return {
            current,
            target:
                this._state.targetConfirmations ||
                this._state.targetConfirmations === 0
                    ? this._state.targetConfirmations
                    : target,
        };
    };

    /**
     * `confirmed` will return once the deposit has reached the target number of
     * confirmations.
     *
     * It returns a PromiEvent which emits a `"confirmation"` event with the
     * current and target number of confirmations as the event parameters.
     *
     * The events emitted by the PromiEvent are:
     * 1. `"confirmation"` - called when a new confirmation is seen
     * 2. `"target"` - called immediately to make the target confirmations
     * available.
     *
     * ```ts
     * await deposit
     *  .confirmed()
     *  .on("target", (confs, target) => console.log(`${confs}/${target}`))
     *  .on("confirmation", (confs, target) => console.log(`${confs}/${target}`))
     * ```
     *
     * @category Main
     */
    public confirmed = (): PromiEvent<
        LockAndMintDeposit<
            LockTransaction,
            LockDeposit,
            LockAddress,
            MintTransaction,
            MintAddress
        >,
        { confirmation: [number, number]; target: [number, number] }
    > => {
        const promiEvent = newPromiEvent<
            LockAndMintDeposit<
                LockTransaction,
                LockDeposit,
                LockAddress,
                MintTransaction,
                MintAddress
            >,
            { confirmation: [number, number]; target: [number, number] }
        >();

        (async () => {
            this._submitMintTransaction().catch((_error) => {
                /* ignore error */
            });

            let currentConfidenceRatio = -Infinity;
            while (true) {
                try {
                    const confidence = await this.confirmations();
                    const confidenceRatio =
                        confidence.target === 0
                            ? 1
                            : confidence.current / confidence.target;
                    if (confidenceRatio > currentConfidenceRatio) {
                        currentConfidenceRatio = confidenceRatio;
                        promiEvent.emit(
                            confidenceRatio === 0 ? "target" : "confirmation",
                            confidence.current,
                            confidence.target,
                        );
                    }
                    if (confidenceRatio >= 1) {
                        break;
                    }
                    this._state.logger.debug(
                        `deposit confidence: ${confidence.current} / ${confidence.target}`,
                    );
                } catch (error) {
                    console.error(error);
                    this._state.logger.error(
                        `Error fetching transaction confidence: ` +
                            extractError(error),
                    );
                }
                await sleep(15 * SECONDS);
            }

            // Update status.
            this.status = DepositStatus.Confirmed;

            return this;
        })()
            .then(promiEvent.resolve)
            .catch(promiEvent.reject);

        return promiEvent;
    };

    /**
     * `signed` waits for RenVM's signature to be available.
     *
     * It returns a PromiEvent which emits a `"txHash"` event with the deposit's
     * RenVM txHash (aka Transaction ID).
     *
     * ```ts
     * await deposit
     *  .signed()
     *  .on("txHash", (txHash) => console.log(txHash))
     * ```
     *
     * The events emitted by the PromiEvent are:
     * 1. `txHash` - the RenVM transaction hash of the deposit.
     * 2. `status` - the RenVM status of the transaction, of type [[TxStatus]].
     *
     * @category Main
     */
    public signed = (): PromiEvent<
        LockAndMintDeposit<
            LockTransaction,
            LockDeposit,
            LockAddress,
            MintTransaction,
            MintAddress
        >,
        { txHash: [string]; status: [TxStatus] }
    > => {
        const promiEvent = newPromiEvent<
            LockAndMintDeposit<
                LockTransaction,
                LockDeposit,
                LockAddress,
                MintTransaction,
                MintAddress
            >,
            { txHash: [string]; status: [TxStatus] }
        >();

        (async () => {
            const utxoTxHash = this.txHash();

            let txHash: string;

            // Try to submit to RenVM. If that fails, see if they already
            // know about the transaction.
            try {
                txHash = await this._submitMintTransaction();
            } catch (error) {
                // this.logger.error(error);
                try {
                    // Check if the darknodes have already seen the transaction
                    const queryTxResponse = await this.queryTx();
                    if (queryTxResponse.txStatus === TxStatus.TxStatusNil) {
                        throw new Error(
                            `Transaction ${utxoTxHash} has not been submitted previously.`,
                        );
                    }
                    txHash = queryTxResponse.hash;
                } catch (errorInner) {
                    // Ignore errorInner.
                    this._state.logger.debug(errorInner);
                    throw error;
                }
            }

            promiEvent.emit("txHash", txHash);
            this._state.logger.debug("renVM txHash:", txHash);

            const response = await this.renVM.waitForTX<LockAndMintTransaction>(
                this._state.selector,
                fromBase64(txHash),
                (status) => {
                    promiEvent.emit("status", status);
                    this._state.logger.debug("transaction status:", status);
                },
                () => promiEvent._isCancelled(),
            );

            // Update status.
            this.status = DepositStatus.Signed;

            this._state.queryTxResult = response;

            this._state.logger.debug(
                "signature:",
                this._state.queryTxResult.out &&
                    this._state.queryTxResult.out.signature,
            );

            return this;
        })()
            .then(promiEvent.resolve)
            .catch(promiEvent.reject);

        return promiEvent;
    };

    /**
     * `findTransaction` checks if the deposit signature has already been
     * submitted to the mint chain.
     *
     * ```ts
     * await deposit.findTransaction();
     * // > "0x1234" // (or undefined)
     * ```
     */
    public findTransaction = async (): Promise<MintTransaction | undefined> => {
        const sigHash =
            this._state.queryTxResult &&
            this._state.queryTxResult.out &&
            this._state.queryTxResult.out.sighash;

        // Check if the signature has already been submitted
        return await this.params.to.findTransaction(
            this.params.asset,
            this._state.nHash,
            sigHash,
        );
    };

    /**
     * `mint` submits the RenVM signature to the mint chain.
     *
     * It returns a PromiEvent and the events emitted depend on the mint chain.
     *
     * The PromiEvent's events are defined by the mint-chain implementation. For
     * Ethereum, it emits the same events as a Web3 PromiEvent.
     *
     * @category Main
     */
    public mint = (
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        override?: { [name: string]: any },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ): PromiEvent<any, { [key: string]: any }> => {
        const promiEvent = newPromiEvent<
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            any,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            { [key: string]: any }
        >();

        (async () => {
            if (!this._state.queryTxResult) {
                throw new Error(
                    `Unable to submit to Ethereum without signature. Call 'signed' first.`,
                );
            }

            const overrideArray = Object.keys(override || {}).map((key) => ({
                name: key,
                value: (override || {})[key],
            }));

            const contractCalls = overrideContractCalls(
                this.params.contractCalls || [],
                { contractParams: overrideArray },
            );

            const asset = this.params.asset;

            const result = await this.params.to.submitMint(
                asset,
                contractCalls,
                this._state.queryTxResult,
                (promiEvent as unknown) as EventEmitter,
            );

            // Update status.
            this.status = DepositStatus.Submitted;

            return result;
        })()
            .then(promiEvent.resolve)
            .catch(promiEvent.reject);

        return promiEvent;
    };

    // Private methods /////////////////////////////////////////////////////////

    /**
     * `_submitMintTransaction` will create the RebVN mint transaction and return
     * its txHash. If `config.submit` is true, it will also submit it to RenVM.
     *
     * Note that `_submitMintTransaction`'s return type changes from `string` to
     * `Promise<string>` if `config.submit` is true. This may be split up into
     * two methods in the future to avoid this weirdness - likely once the `v1`
     * RPC format is phased out.
     *
     * @param config Set `config.submit` to `true` to submit the transaction.
     */
    private _submitMintTransaction = async (): Promise<string> => {
        const { token } = this._state;

        if (!token) {
            throw new Error(`Deposit object must be initialized.`);
        }

        const returnedTxHash = (this.renVM.version(this._state.selector) >= 2
            ? toURLBase64
            : toBase64)(
            await this.renVM.submitMint({
                ...this._state,
                token,
            }),
        );

        const expectedTxHash = this.txHash();
        if (returnedTxHash !== expectedTxHash) {
            this._state.logger.warn(
                `Unexpected txHash returned from RenVM. Received: ${returnedTxHash}, expected: ${expectedTxHash}`,
            );
        }
        return returnedTxHash;
    };

    private readonly validateParams = () => {
        assertObject(
            {
                from: "object",
                to: "object",
                contractCalls: "any[]",
                asset: "string",
                txHash: "string | undefined",
                nonce: "Buffer | string | undefined",
                tags: "string[] | undefined",
            },
            { params: this.params },
        );

        if (this.params.contractCalls) {
            this.params.contractCalls.map((contractCall) => {
                assertType<string>("string", {
                    sendTo: contractCall.sendTo,
                    contractFn: contractCall.contractFn,
                });
            });
        }
    };
}
