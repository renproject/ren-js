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
    RenJSErrors,
    RenNetworkDetails,
    TxStatus,
    TxStatusIndex,
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
    isDefined,
    keccak256,
    overrideContractCalls,
    Ox,
    payloadToMintABI,
    renVMHashToBase64,
    retryNTimes,
    SECONDS,
    sleep,
    strip0x,
    toBase64,
    toURLBase64,
} from "@renproject/utils";
import { EventEmitter } from "events";
import { OrderedMap } from "immutable";
import { AbiCoder } from "web3-eth-abi";
import { RenJSConfig } from "./config";
import base58 from "bs58";

interface MintState {
    logger: Logger;
    selector: string;

    config: RenJSConfig & { networkDelay: number };
}

interface MintStatePartial {
    renNetwork: RenNetworkDetails;
    gPubKey: Buffer;
    gHash: Buffer;
    pHash: Buffer;
    targetConfirmations: number | undefined;
    token?: string;
}

export interface DepositState {
    renTxSubmitted: boolean;
    queryTxResult?: LockAndMintTransaction;
    queryTxResultTimestamp?: number | undefined;
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
    LockDeposit extends DepositCommon<LockTransaction> = DepositCommon<LockTransaction>,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    LockAddress extends string | { address: string } = any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    MintTransaction = any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    MintAddress extends string | { address: string } = any
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

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    private getDepositsProgress: any | undefined;

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
        config: RenJSConfig = {},
    ) {
        super();

        this.params = params;
        this.renVM = renVM;
        this._state = {
            logger: config.logger || NullLogger,
            selector: this.renVM.selector(this.params),

            config: {
                ...config,
                networkDelay: config.networkDelay || 15 * SECONDS,
            },
        };

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

    public confirmationTarget = async () => {
        if (isDefined(this._state.targetConfirmations)) {
            return this._state.targetConfirmations;
        }

        let target;
        const getConfirmationTarget = this.renVM.getConfirmationTarget;
        if (getConfirmationTarget) {
            target = await retryNTimes(
                async () =>
                    getConfirmationTarget(
                        this._state.selector,
                        this.params.from,
                    ),
                2,
            );
        }
        const defaultConfirmations =
            this._state.renNetwork && this._state.renNetwork.isTestnet ? 2 : 6;
        this._state.targetConfirmations = isDefined(target)
            ? target
            : defaultConfirmations;

        return this._state.targetConfirmations;
    };

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
            this._state.targetConfirmations = await this.confirmationTarget();
        } catch (error) {
            console.error(error);
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
            >(
                deposit,
                this.params,
                this.renVM,
                {
                    ...this._state,
                    renNetwork: this._state.renNetwork,
                    pHash: this._state.pHash,
                    gHash: this._state.gHash,
                    gPubKey: this._state.gPubKey,
                    token: this._state.token,
                    targetConfirmations: isDefined(
                        this._state.targetConfirmations,
                    )
                        ? this._state.targetConfirmations
                        : undefined,
                },
                this.gatewayAddress,
            );

            await depositObject._initialize();

            // Check if deposit has already been submitted.
            if (
                this._state.config.loadCompletedDeposits ||
                depositObject.status !== DepositStatus.Submitted
            ) {
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

    private readonly generateGatewayAddress = async (): Promise<LockAddress> => {
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
        const { contractParams, sendTo, contractFn } = contractCalls[
            contractCalls.length - 1
        ];

        // FIXME: dirty hack, but we need to re-write how we deal with
        // addresses in order to do this cleanly
        // (need to follow the multichain address pattern)
        const sendToHex =
            this.params.to.name == "Solana"
                ? base58.decode(sendTo).toString("hex")
                : sendTo;

        this._state.pHash = generatePHash(
            contractParams || [],
            this._state.logger,
        );

        // Check if the transaction is either a v0.2 transaction, or has the
        // version set to `0` in a v0.4 transaction.
        // See [RenJSConfig.transactionVersion]
        const v0Transaction =
            this.renVM.version(this._state.selector) === 1 ||
            this._state.config.transactionVersion === 0;

        const tokenGatewayContract = !v0Transaction
            ? Ox(generateSHash(this._state.selector))
            : await this.params.to.resolveTokenGatewayContract(
                  this.params.asset,
              );

        const gHash = generateGHash(
            contractParams || [],
            sendToHex,
            tokenGatewayContract,
            fromHex(nonce),
            !v0Transaction,
            this._state.logger,
        );
        this._state.gHash = gHash;
        this._state.gPubKey =
            this._state.config.gPubKey ||
            (await this.renVM.selectPublicKey(
                this._state.selector,
                this.renVM.version(this._state.selector) >= 2
                    ? this.params.from.name
                    : this.params.asset,
            ));
        this._state.logger.debug("gPubKey:", Ox(this._state.gPubKey));

        const gatewayAddress = await this.params.from.getGatewayAddress(
            this.params.asset,
            this._state.gPubKey,
            gHash,
        );
        this.gatewayAddress = gatewayAddress;
        this._state.logger.debug("gateway address:", this.gatewayAddress);

        const filteredContractParams = contractParams
            ? contractParams.filter(
                  (contractParam) => !contractParam.notInPayload,
              )
            : contractParams;

        const encodedParameters = new AbiCoder().encodeParameters(
            (filteredContractParams || []).map((i) => i.type),
            (filteredContractParams || []).map((i) => i.value),
        );

        const fnABI = payloadToMintABI(
            contractFn,
            filteredContractParams || [],
        );

        if (this.params.tags && this.params.tags.length > 1) {
            throw new Error("Providing multiple tags is not supported yet.");
        }

        const tags: [string] | [] =
            this.params.tags && this.params.tags.length
                ? [this.params.tags[0]]
                : [];

        this._state.token = await this.params.to.resolveTokenGatewayContract(
            this.params.asset,
        );

        if (this.renVM.submitGatewayDetails) {
            try {
                await this.renVM.submitGatewayDetails(
                    this.params.from.addressToString(gatewayAddress),
                    {
                        ...(this._state as MintState & MintStatePartial),
                        token: this._state.token,
                        nHash: Buffer.from(
                            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
                            "base64",
                        ),
                        payload: fromHex(encodedParameters),
                        nonce: fromHex(nonce),
                        fn: contractFn,
                        fnABI,
                        to:
                            this.renVM.version(this._state.selector) >= 2
                                ? strip0x(sendTo)
                                : Ox(sendTo),
                        tags,

                        // See [RenJSConfig.transactionVersion]
                        transactionVersion: this._state.config
                            .transactionVersion,
                    },
                    5,
                );
            } catch (error) {
                // Ignore error.
            }
        }

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
                // If there are no listeners, continue. TODO: Exit loop entirely
                // until a lister is added again.
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
                this.getDepositsProgress = await this.params.from.getDeposits(
                    this.params.asset,
                    this.gatewayAddress,
                    this.getDepositsProgress,
                    onDeposit,
                    cancelDeposit,
                    listenerCancelled,
                );
            } catch (error) {
                this._state.logger.error(extractError(error));
            }

            await sleep(this._state.config.networkDelay);
        }
    };
}

export enum DepositStatus {
    Detected = "detected",
    Confirmed = "confirmed",
    Signed = "signed",
    Reverted = "reverted",
    Submitted = "submitted",
}

export const DepositStatusIndex = {
    [DepositStatus.Detected]: 0,
    [DepositStatus.Confirmed]: 1,
    [DepositStatus.Signed]: 2,
    [DepositStatus.Reverted]: 3,
    [DepositStatus.Submitted]: 4,
};

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
    LockDeposit extends DepositCommon<LockTransaction> = DepositCommon<LockTransaction>,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    LockAddress extends string | { address: string } = any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    MintTransaction = any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    MintAddress extends string | { address: string } = any
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

    public mintTransaction?: MintTransaction;
    public revertReason?: string;

    public gatewayAddress: LockAddress | undefined;

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
        gatewayAddress?: LockAddress,
    ) {
        assertObject(
            {
                transaction: "any",
                amount: "string",
            },
            {
                depositDetails: depositDetails as DepositCommon<LockTransaction>,
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
                config: "object",
            },
            { state },
        );

        this.depositDetails = depositDetails;
        this.params = params;
        this.renVM = renVM;
        this.gatewayAddress = gatewayAddress;
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

        const { pHash, config } = state;

        // Check if the transaction is either a v0.2 transaction, or has the
        // version set to `0` in a v0.4 transaction.
        // See [RenJSConfig.transactionVersion]
        const v0Transaction =
            this.renVM.version(state.selector) === 1 ||
            config.transactionVersion === 0;

        const transactionDetails = this.params.from.transactionRPCFormat(
            this.depositDetails.transaction,
            !v0Transaction,
        );

        const nHash = generateNHash(
            fromHex(nonce),
            transactionDetails.txid,
            transactionDetails.txindex,
            !v0Transaction,
        );

        const outputHashFormat =
            renVM.version(state.selector) >= 2
                ? ""
                : this.params.from.depositV1HashString(deposit);

        const fnABI = payloadToMintABI(
            contractFn,
            filteredContractParams || [],
        );

        if (this.params.tags && this.params.tags.length > 1) {
            throw new Error("Providing multiple tags is not supported yet.");
        }

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
            renTxSubmitted: false,
        };

        this._state.txHash = (renVM.version(this._state.selector) >= 2
            ? toURLBase64
            : toBase64)(
            this.renVM.mintTxHash({
                ...this._state,
                outputHashFormat,

                // See [RenJSConfig.transactionVersion]
                transactionVersion: config.transactionVersion,
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
            this._state.logger.debug(
                "LockAndMintDeposit created",
                depositDetails,
                restOfParams,
            );
        }
    }

    /** @hidden */
    public readonly _initialize = async (): Promise<this> => {
        await this.refreshStatus();
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
        if (
            DepositStatusIndex[this.status] >=
                DepositStatusIndex[DepositStatus.Signed] &&
            this._state.queryTxResult
        ) {
            return this._state.queryTxResult;
        }

        const response: LockAndMintTransaction = await this.renVM.queryMintOrBurn(
            this._state.selector,
            fromBase64(this.txHash()),
        );
        this._state.queryTxResult = response;

        // Update status.
        if (response.out && response.out.revert !== undefined) {
            this.status = DepositStatus.Reverted;
            this.revertReason = response.out.revert.toString();
        } else if (response.out && response.out.signature) {
            if (
                DepositStatusIndex[this.status] <
                DepositStatusIndex[DepositStatus.Signed]
            ) {
                this.status = DepositStatus.Signed;
            }
        }

        return response;
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
            try {
                queryTxResult = await this.queryTx();
            } catch (_error) {
                // Ignore error.
                queryTxResult = null;
            }

            try {
                // Ensure that
                const transaction = await this.findTransaction();
                if (transaction !== undefined) {
                    return DepositStatus.Submitted;
                }
            } catch (_error) {
                // Ignore error.
            }

            try {
                queryTxResult =
                    queryTxResult === undefined
                        ? await this.queryTx()
                        : queryTxResult;
                if (
                    queryTxResult &&
                    queryTxResult.txStatus === TxStatus.TxStatusDone
                ) {
                    // Check if transaction was reverted.
                    if (
                        queryTxResult.out &&
                        queryTxResult.out.revert !== undefined
                    ) {
                        this.status = DepositStatus.Reverted;
                        this.revertReason = queryTxResult.out.revert.toString();
                    } else {
                        return DepositStatus.Signed;
                    }
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
            target: isDefined(this._state.targetConfirmations)
                ? this._state.targetConfirmations
                : target,
        };
    };

    public confirmationTarget = async () => {
        if (isDefined(this._state.targetConfirmations)) {
            return this._state.targetConfirmations;
        }

        let target;
        const getConfirmationTarget = this.renVM.getConfirmationTarget;
        if (getConfirmationTarget) {
            target = await retryNTimes(
                async () =>
                    getConfirmationTarget(
                        this._state.selector,
                        this.params.from,
                    ),
                2,
            );
        }
        const defaultConfirmations =
            this._state.renNetwork && this._state.renNetwork.isTestnet ? 2 : 6;
        this._state.targetConfirmations = isDefined(target)
            ? target
            : defaultConfirmations;

        return this._state.targetConfirmations;
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
     *  .on("target", (target) => console.log(`Waiting for ${target} confirmations`))
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
        { confirmation: [number, number]; target: [number] }
    > => {
        const promiEvent = newPromiEvent<
            LockAndMintDeposit<
                LockTransaction,
                LockDeposit,
                LockAddress,
                MintTransaction,
                MintAddress
            >,
            { confirmation: [number, number]; target: [number] }
        >();

        (async () => {
            try {
                promiEvent.emit("target", await this.confirmationTarget());
            } catch (error) {
                this._state.logger.error(error);
            }

            // If the transaction has been confirmed according to RenVM, return.
            const transactionIsConfirmed = () =>
                DepositStatusIndex[this.status] >=
                    DepositStatusIndex[DepositStatus.Confirmed] ||
                (this._state.queryTxResult &&
                    TxStatusIndex[this._state.queryTxResult.txStatus] >=
                        TxStatusIndex[TxStatus.TxStatusPending]);

            let iterationCount = 0;
            let currentConfidenceRatio = 0;
            // Continue while the transaction isn't confirmed and the promievent
            // isn't cancelled.
            while (!promiEvent._isCancelled() && !transactionIsConfirmed()) {
                // In the first loop, submit to RenVM immediately.
                if (iterationCount % 5 === 0) {
                    try {
                        if (!this._state.renTxSubmitted) {
                            await this._submitMintTransaction();
                        }
                        await this.queryTx();
                        if (transactionIsConfirmed()) {
                            break;
                        }
                    } catch (error) {
                        // Ignore error.
                        this._state.logger.debug(error);
                    }
                }

                try {
                    const confidence = await this.confirmations();
                    const confidenceRatio =
                        confidence.target === 0
                            ? 1
                            : confidence.current / confidence.target;
                    if (confidenceRatio > currentConfidenceRatio) {
                        currentConfidenceRatio = confidenceRatio;
                        promiEvent.emit(
                            "confirmation",
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
                    this._state.logger.error(
                        `Error fetching transaction confidence: ${extractError(
                            error,
                        )}`,
                    );
                }
                await sleep(this._state.config.networkDelay);
                iterationCount += 1;
            }

            // Update status.
            if (
                DepositStatusIndex[this.status] <
                DepositStatusIndex[DepositStatus.Confirmed]
            ) {
                this.status = DepositStatus.Confirmed;
            }

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
            let txHash = this.txHash();

            // If the transaction has been reverted, throw the revert reason.
            if (this.status === DepositStatus.Reverted) {
                throw new Error(
                    this.revertReason ||
                        `RenVM transaction ${txHash} reverted.`,
                );
            }

            // Check if the signature is already available.
            if (
                DepositStatusIndex[this.status] >=
                    DepositStatusIndex[DepositStatus.Signed] &&
                this._state.queryTxResult &&
                this._state.queryTxResult.out
            ) {
                // NO_COMMIT
                // return this;
            }

            promiEvent.emit("txHash", txHash);
            this._state.logger.debug("RenVM txHash:", txHash);

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
                            `Transaction ${txHash} has not been submitted previously.`,
                        );
                    }
                    txHash = queryTxResponse.hash;
                } catch (errorInner) {
                    let submitted = false;

                    // If transaction is not found, check for RenVM v0.2 error message.
                    if (
                        errorInner.code === RenJSErrors.RenVMTransactionNotFound
                    ) {
                        if (
                            error.code === RenJSErrors.AmountTooSmall ||
                            error.code === RenJSErrors.DepositSpentOrNotFound
                        ) {
                            this.status = DepositStatus.Reverted;
                            this.revertReason = String(
                                (error || {}).message,
                            ).replace(
                                /Node returned status \d+ with reason: /,
                                "",
                            );
                            throw new Error(this.revertReason);
                        } else {
                            // Retry submitting 2 more times to reduce chance
                            // of network issues causing problems.
                            txHash = await retryNTimes(
                                async () => this._submitMintTransaction(),
                                2,
                                5 * SECONDS,
                            );
                            submitted = true;
                        }
                    }

                    // Ignore errorInner.
                    this._state.logger.debug(errorInner);

                    if (!submitted) {
                        throw error;
                    }
                }
            }

            const response = await this.renVM.waitForTX<LockAndMintTransaction>(
                this._state.selector,
                fromBase64(txHash),
                (status) => {
                    promiEvent.emit("status", status);
                    this._state.logger.debug("transaction status:", status);
                },
                () => promiEvent._isCancelled(),
                this._state.config.networkDelay,
            );

            this._state.queryTxResult = response;

            // Update status.
            if (response.out && response.out.revert !== undefined) {
                this.status = DepositStatus.Reverted;
                this.revertReason = response.out.revert.toString();
                throw new Error(this.revertReason);
            } else if (response.out && response.out.signature) {
                if (
                    DepositStatusIndex[this.status] <
                    DepositStatusIndex[DepositStatus.Signed]
                ) {
                    this.status = DepositStatus.Signed;
                }

                this._state.logger.debug(
                    "signature:",
                    response.out && response.out.signature,
                );
            }

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
        if (this.params.to.findTransaction) {
            const sigHash =
                this._state.queryTxResult &&
                this._state.queryTxResult.out &&
                this._state.queryTxResult.out.revert === undefined
                    ? this._state.queryTxResult.out.sighash
                    : undefined;

            // Check if the signature has already been submitted
            this.mintTransaction = await this.params.to.findTransaction(
                this.params.asset,
                this._state.nHash,
                sigHash,
            );
            return this.mintTransaction;
        }
        if (
            this.params.contractCalls &&
            this.params.to.findTransactionByDepositDetails &&
            this._state.queryTxResult &&
            this._state.queryTxResult.out &&
            this._state.queryTxResult.out.revert === undefined
        ) {
            this.mintTransaction = await this.params.to.findTransactionByDepositDetails(
                this.params.asset,
                keccak256(Buffer.from(this._state.selector)),
                this._state.nHash,
                this._state.pHash,
                this.params.contractCalls[0].sendTo,
                this._state.queryTxResult.out.amount,
            );
            return this.mintTransaction;
        }
        return undefined;
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
        override?: { [name: string]: unknown },
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

            // Override contract call parameters that have been passed in to
            // "mint".
            let contractCalls = overrideContractCalls(
                this.params.contractCalls || [],
                { contractParams: overrideArray },
            );

            // Filter parameters that should be included in the payload hash but
            // not the contract call.
            contractCalls = contractCalls.map((call) => ({
                ...call,
                contractParams: call.contractParams
                    ? call.contractParams.filter(
                          (param) => !param.onlyInPayload,
                      )
                    : call.contractParams,
            }));

            const asset = this.params.asset;

            this.mintTransaction = await this.params.to.submitMint(
                asset,
                contractCalls,
                this._state.queryTxResult,
                (promiEvent as unknown) as EventEmitter,
            );

            // Update status.
            this.status = DepositStatus.Submitted;

            return this.mintTransaction;
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

        const expectedTxHash = this.txHash();

        // Return if the transaction has already been successfully submitted.
        if (this._state.renTxSubmitted) {
            return expectedTxHash;
        }

        // The transaction has already been submitted and accepted.
        if (this._state.renTxSubmitted) {
            return expectedTxHash;
        }

        const encodedHash = await this.renVM.submitMint({
            ...this._state,
            token,

            // See [RenJSConfig.transactionVersion]
            transactionVersion: this._state.config.transactionVersion,
        });

        const returnedTxHash =
            this.renVM.version(this._state.selector) >= 2
                ? toURLBase64(encodedHash)
                : toBase64(encodedHash);

        // Indicate that the tx has been submitted successfully.
        this._state.renTxSubmitted = true;

        if (returnedTxHash !== expectedTxHash) {
            this._state.logger.warn(
                `Unexpected txHash returned from RenVM. Received: ${returnedTxHash}, expected: ${expectedTxHash}`,
            );
        }

        this._state.renTxSubmitted = true;

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
