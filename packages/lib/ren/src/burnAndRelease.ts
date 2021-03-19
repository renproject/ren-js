import {
    BurnAndReleaseParams,
    BurnAndReleaseTransaction,
    BurnDetails,
    DepositCommon,
    getRenNetworkDetails,
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
    fromBase64,
    generateBurnTxHash,
    generateGHash,
    generateNHash,
    generatePHash,
    generateSHash,
    isDefined,
    Ox,
    renVMHashToBase64,
    retryNTimes,
    SECONDS,
    toBase64,
    toURLBase64,
} from "@renproject/utils";
import BN from "bn.js";
import { EventEmitter } from "events";
import BigNumber from "bignumber.js";
import { RenJSConfig } from "./config";

export enum BurnAndReleaseStatus {
    Pending = "pending",
    Burned = "burned",
    Released = "released",
    Reverted = "reverted",
}

export class BurnAndRelease<
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
    /** The details of the burn, including the amount and recipient. */
    public burnDetails: BurnDetails<MintTransaction> | undefined;

    /** The parameters passed in when calling [[RenJS.burnAndRelease]]. */
    public params: BurnAndReleaseParams<
        LockTransaction,
        LockDeposit,
        LockAddress,
        MintTransaction,
        MintAddress
    >;

    /**
     * The status of the burn, updated automatically.
     *
     * ```ts
     * burnAndRelease.status;
     * // > "released"
     * ```
     */
    public status: BurnAndReleaseStatus;

    /** See [[RenJS.renVM]]. */
    public readonly renVM: AbstractRenVMProvider;

    /**
     * Internal state of the burn object. Interface may change across minor and
     * patch releases.
     */
    public readonly _state: {
        targetConfirmations: number | undefined;
        logger: Logger;
        gPubKey?: Buffer;
        queryTxResult?: BurnAndReleaseTransaction;
        renNetwork?: RenNetworkDetails;
        selector: string;
        config: RenJSConfig & { networkDelay: number };
    };

    public revertReason?: string;
    public releaseTransaction?: LockTransaction;

    /** @hidden */
    constructor(
        renVM: AbstractRenVMProvider,
        params: BurnAndReleaseParams<
            LockTransaction,
            LockDeposit,
            LockAddress,
            MintTransaction,
            MintAddress
        >,
        config: RenJSConfig = {},
    ) {
        this.params = params;
        this.renVM = renVM;
        this._state = {
            logger: config.logger || NullLogger,
            selector: this.renVM.selector(this.params),
            targetConfirmations: undefined,
            config: {
                ...config,
                networkDelay: config.networkDelay || 15 * SECONDS,
            },
        };

        this.validateParams();

        this.status = this.params.txHash
            ? BurnAndReleaseStatus.Burned
            : BurnAndReleaseStatus.Pending;

        {
            // Debug log
            const { ...restOfParams } = this.params;
            this._state.logger.debug("burnAndRelease created:", restOfParams);
        }
    }

    private readonly validateParams = () => {
        assertObject(
            {
                from: "object | undefined",
                to: "object",
                transaction: "any | undefined",
                burnNonce: "string | number | undefined",
                contractCalls: "any[] | undefined",
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

    /** @hidden */
    public readonly _initialize = async (): Promise<this> => {
        this._state.renNetwork =
            this._state.renNetwork ||
            getRenNetworkDetails(
                await this.renVM.getNetwork(this._state.selector),
            );

        if (this.params.from && !this.params.from.renNetwork) {
            await this.params.from.initialize(this._state.renNetwork);
        }
        if (!this.params.to.renNetwork) {
            await this.params.to.initialize(this._state.renNetwork);
        }

        const burnPayload =
            this.params.to.burnPayload && (await this.params.to.burnPayload());

        const overwriteParams =
            this.params.from &&
            this.params.from.getBurnParams &&
            (await this.params.from.getBurnParams(
                this.params.asset,
                burnPayload,
            ));

        this.params = {
            ...overwriteParams,
            ...this.params,
        };

        if (this.renVM.version(this._state.selector) == 2) {
            this._state.gPubKey = await this.renVM.selectPublicKey(
                this._state.selector,
                this.params.to.name,
            );
        }

        return this;
    };

    /**
     * TODO: Refresh the BurnAndRelease status by checking the status of the
     * mint-chain transaction and the RenVM transaction.
     *
     * ```ts
     * await burnAndRelease.refreshStatus();
     * // > "released"
     * ```
     */
    // eslint-disable-next-line @typescript-eslint/require-await
    public refreshStatus = async (): Promise<BurnAndReleaseStatus> => {
        return this.status;
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
        this._state.targetConfirmations = isDefined(target) ? target : 6;

        return this._state.targetConfirmations;
    };

    /**
     * Read a burn reference from an Ethereum transaction - or submit a
     * transaction first if the transaction details have been provided.
     */
    public burn = (): PromiEvent<
        BurnAndRelease<
            LockTransaction,
            LockDeposit,
            LockAddress,
            MintTransaction,
            MintAddress
        >,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        {
            transactionHash: [string];
            confirmation: [number, number];
        }
    > => {
        const promiEvent = newPromiEvent<
            BurnAndRelease<
                LockTransaction,
                LockDeposit,
                LockAddress,
                MintTransaction,
                MintAddress
            >,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            {
                transactionHash: [string];
                confirmation: [number, number];
            }
        >();

        (async () => {
            if (this.params.txHash) {
                return this;
            }

            if (!this.params.from) {
                throw new Error(
                    `Must either provide field \`to\` or field \`txHash\`.`,
                );
            }

            const {
                asset,
                transaction,
                burnNonce,
                contractCalls,
            } = this.params;

            this.burnDetails = await this.params.from.findBurnTransaction(
                asset,
                {
                    transaction,
                    burnNonce,
                    contractCalls,
                },
                (promiEvent as unknown) as EventEmitter,
                this._state.logger,
                this._state.config.networkDelay,
            );

            this.status = BurnAndReleaseStatus.Burned;

            return this;
        })()
            .then(promiEvent.resolve)
            .catch(promiEvent.reject);

        return promiEvent;
    };

    /**
     * `txHash` returns the RenVM transaction hash, which is distinct from the
     * lock or mint chain transaction hashes. It can be used to query the
     * burn-and-release details from RenVM once they've been submitted to it.
     *
     * The RenVM txHash is a URL-base64 string.
     *
     * ```ts
     * burnAndRelease.txHash();
     * // > "QNM87rNDuxx54H7VK7D_NAU0u_mjk09-G25IJZL1QrI"
     * ```
     */
    public txHash = (): string => {
        const txHash = this.params.txHash;
        if (txHash) {
            return renVMHashToBase64(
                txHash,
                this.renVM.version(this._state.selector) >= 2,
            );
        }

        if (!this.params.from) {
            throw new Error(
                `Must either provide field \`to\` or field \`txHash\`.`,
            );
        }

        if (!this.burnDetails) {
            throw new Error("Must call `burn` before calling `txHash`.");
        }

        if (
            this.renVM.version(this._state.selector) >= 2 &&
            this.renVM.burnTxHash
        ) {
            const { transaction, amount, to, nonce } = this.burnDetails;

            const payload = Buffer.from([]);
            const pHash = generatePHash([], this._state.logger);
            const { txid, txindex } = this.params.from.transactionRPCFormat(
                transaction,
                true,
            );
            const nonceBuffer = new BN(nonce.toFixed()).toArrayLike(
                Buffer,
                "be",
                32,
            );

            const nHash = generateNHash(
                nonceBuffer,
                txid,
                txindex,
                this.renVM.version(this._state.selector) >= 2,
                this._state.logger,
            );
            const sHash = generateSHash(
                `${this.params.asset}/to${this.params.to.name}`,
            );

            const gHash = generateGHash(
                [],
                Ox(this.params.to.addressStringToBytes(to)),
                Ox(sHash),
                nonceBuffer,
                this.renVM.version(this._state.selector) >= 2,
                this._state.logger,
            );

            const { gPubKey } = this._state;

            if (!gPubKey) {
                throw new Error(`BurnAndRelease object must be initialized.`);
            }

            return toURLBase64(
                this.renVM.burnTxHash({
                    selector: this._state.selector,
                    gHash,
                    gPubKey,
                    nHash,
                    nonce: nonceBuffer,
                    output: {
                        txid,
                        txindex,
                    },
                    amount: amount.toFixed(),
                    payload,
                    pHash,
                    to: to.toString(),
                }),
            );
        } else {
            return toBase64(
                generateBurnTxHash(
                    this._state.selector,
                    this.burnDetails.nonce.toFixed(),
                    this._state.logger,
                ),
            );
        }
    };

    /**
     * queryTx requests the status of the burn from RenVM.
     */
    public queryTx = async (): Promise<BurnAndReleaseTransaction> => {
        const burnTransaction: BurnAndReleaseTransaction = await this.renVM.queryMintOrBurn(
            this._state.selector,
            fromBase64(this.txHash()),
        );
        this._state.queryTxResult = burnTransaction;
        return burnTransaction;
    };

    /**
     * submit queries RenVM for the status of the burn until the funds are
     * released.
     */
    public release = (): PromiEvent<
        BurnAndReleaseTransaction,
        {
            txHash: [string];
            status: [TxStatus];
            transaction: [LockTransaction];
        }
    > => {
        const promiEvent = newPromiEvent<
            BurnAndReleaseTransaction,
            {
                txHash: [string];
                status: [TxStatus];
                transaction: [LockTransaction];
            }
        >();

        (async () => {
            if (!this.burnDetails && !this.params.txHash) {
                throw new Error("Must call `burn` before calling `release`.");
            }

            const txHash = this.txHash();

            if (!this.params.txHash && this.burnDetails) {
                if (!this.params.from) {
                    throw new Error(
                        `Must either provide field \`to\` or field \`txHash\`.`,
                    );
                }

                if (this.params.tags && this.params.tags.length > 1) {
                    throw new Error(
                        "Providing multiple tags is not supported yet.",
                    );
                }
                const tags: [string] | [] =
                    this.params.tags && this.params.tags.length
                        ? [this.params.tags[0]]
                        : [];

                const { transaction, amount, to, nonce } = this.burnDetails;

                try {
                    let returnedTxHash: string;

                    if (this.renVM.version(this._state.selector) >= 2) {
                        assertType<string>("string", { to });

                        const { gPubKey } = this._state;

                        if (!gPubKey) {
                            throw new Error(
                                `BurnAndRelease object must be initialized.`,
                            );
                        }

                        const payload = Buffer.from([]);
                        const pHash = generatePHash([], this._state.logger);
                        const {
                            txid,
                            txindex,
                        } = this.params.from.transactionRPCFormat(
                            transaction,
                            true,
                        );
                        const nonceBuffer = new BN(nonce.toFixed()).toArrayLike(
                            Buffer,
                            "be",
                            32,
                        );

                        const nHash = generateNHash(
                            nonceBuffer,
                            txid,
                            txindex,
                            this.renVM.version(this._state.selector) >= 2,
                            this._state.logger,
                        );
                        const sHash = generateSHash(
                            `${this.params.asset}/to${this.params.to.name}`,
                        );

                        const gHash = generateGHash(
                            [],
                            Ox(this.params.to.addressStringToBytes(to)),
                            Ox(sHash),
                            nonceBuffer,
                            this.renVM.version(this._state.selector) >= 2,
                            this._state.logger,
                        );

                        returnedTxHash = toURLBase64(
                            await this.renVM.submitBurn({
                                selector: this._state.selector,
                                tags,

                                gHash,
                                gPubKey,
                                nHash,
                                nonce: nonceBuffer,
                                output: {
                                    txid,
                                    txindex,
                                },
                                amount: amount.toFixed(),
                                payload,
                                pHash,
                                to: to.toString(),

                                // from v1
                                burnNonce: new BigNumber(0),
                            }),
                        );
                    } else {
                        returnedTxHash = toBase64(
                            await this.renVM.submitBurn({
                                selector: this._state.selector,
                                tags,
                                burnNonce: nonce,

                                // for v2
                                gHash: Buffer.from([]),
                                gPubKey: Buffer.from([]),
                                nHash: Buffer.from([]),
                                nonce: Buffer.from([]),
                                output: { txid: Buffer.from([]), txindex: "" },
                                amount: "",
                                payload: Buffer.from([]),
                                pHash: Buffer.from([]),
                                to: "",
                            }),
                        );
                    }
                    if (txHash && txHash !== returnedTxHash) {
                        this._state.logger.warn(
                            `Unexpected txHash returned from RenVM. Received: ${returnedTxHash}, expected: ${txHash}`,
                        );
                    }
                } catch (error) {
                    // TODO: Check against already being submitted.
                    throw error;
                }
            }

            // const txHash = await this.renVMNetwork.submitTokenFromEthereum(this.params.sendToken, burnNonce);
            promiEvent.emit("txHash", txHash);
            this._state.logger.debug("txHash:", txHash);

            const response = await this.renVM.waitForTX<BurnAndReleaseTransaction>(
                this._state.selector,
                fromBase64(txHash),
                (status) => {
                    promiEvent.emit("status", status);
                    this._state.logger.debug("transaction status:", status);
                },
                () => promiEvent._isCancelled(),
                this._state.config.networkDelay,
            );

            if (response.out && response.out.revert !== undefined) {
                this.status = BurnAndReleaseStatus.Reverted;
                this.revertReason = response.out.revert.toString();
                throw new Error(this.revertReason);
            } else {
                this.status = BurnAndReleaseStatus.Released;

                if (
                    response.out &&
                    this.renVM.version(this._state.selector) >= 2
                ) {
                    let transaction: LockTransaction | undefined;
                    try {
                        if (response.out.txid) {
                            const txid = response.out.txid;
                            transaction = await this.params.to.transactionFromID(
                                txid,
                                "",
                                true,
                            );
                        } else if (response.out.outpoint) {
                            const { hash, index } = response.out.outpoint;
                            transaction = await this.params.to.transactionFromID(
                                hash,
                                index.toFixed(),
                                true,
                            );
                        }
                    } catch (error) {
                        this._state.logger.debug(error);
                    }

                    if (transaction) {
                        this.releaseTransaction = transaction;
                        promiEvent.emit("transaction", transaction);
                    }
                }
            }

            return response;
        })()
            .then(promiEvent.resolve)
            .catch(promiEvent.reject);

        return promiEvent;
    };
}
