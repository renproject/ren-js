import {
    BurnAndReleaseParams,
    BurnAndReleaseTransaction,
    BurnDetails,
    DepositCommon,
    getRenNetworkDetails,
    LockChain,
    Logger,
    MintChain,
    newPromiEvent,
    NullLogger,
    PromiEvent,
    RenNetworkDetails,
    TxStatus,
} from "@renproject/interfaces";
import { AbstractRenVMProvider, v2 } from "@renproject/rpc";
import {
    assertObject,
    assertType,
    fromBase64,
    generateBurnTxHash,
    generateGHash,
    generateNHash,
    generatePHash,
    generateSHash,
    Ox,
    renVMHashToBase64,
    resolveOutToken,
    toBase64,
    toURLBase64,
} from "@renproject/utils";
import BN from "bn.js";
import { EventEmitter } from "events";
import BigNumber from "bignumber.js";

export enum BurnAndReleaseStatus {
    Pending = "pending",
    Burned = "burned",
    Released = "released",
}

export class BurnAndRelease<
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
    public burnDetails: BurnDetails<MintTransaction> | undefined;

    public params: BurnAndReleaseParams<
        LockTransaction,
        LockDeposit,
        LockAddress,
        MintTransaction,
        MintAddress
    >;
    public status: BurnAndReleaseStatus;
    public readonly renVM: AbstractRenVMProvider;

    public readonly _state: {
        logger: Logger;
        gPubKey?: Buffer;
        queryTxResult?: BurnAndReleaseTransaction;
        renNetwork?: RenNetworkDetails;
    };

    constructor(
        renVM: AbstractRenVMProvider,
        params: BurnAndReleaseParams<
            LockTransaction,
            LockDeposit,
            LockAddress,
            MintTransaction,
            MintAddress
        >,
        logger: Logger = NullLogger,
    ) {
        this.renVM = renVM;
        this.params = params; // processBurnAndReleaseParams(this.network, _params);
        this._state = {
            logger,
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

    public readonly _initialize = async (): Promise<this> => {
        this._state.renNetwork =
            this._state.renNetwork ||
            getRenNetworkDetails(await this.renVM.getNetwork());

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

        if (this.renVM.version >= 2) {
            this._state.gPubKey = await this.renVM.selectPublicKey(
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
     * await deposit.refreshStatus();
     * // > "released"
     * ```
     */
    // eslint-disable-next-line @typescript-eslint/require-await
    public refreshStatus = async (): Promise<BurnAndReleaseStatus> => {
        return this.status;
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
        { [event: string]: any }
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
            { [event: string]: any }
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
            );

            this.status = BurnAndReleaseStatus.Burned;

            return this;
        })()
            .then(promiEvent.resolve)
            .catch(promiEvent.reject);

        return promiEvent;
    };

    /**
     * txHash calculates the RenVM transaction hash for the burn. This is
     * used to track the progress of the release in RenVM.
     */
    public txHash = (): string => {
        const txHash = this.params.txHash;
        if (txHash) {
            return renVMHashToBase64(txHash, this.renVM.version >= 2);
        }

        if (!this.params.from) {
            throw new Error(
                `Must either provide field \`to\` or field \`txHash\`.`,
            );
        }

        if (!this.burnDetails) {
            throw new Error("Must call `burn` before calling `txHash`");
        }

        if (this.renVM.version >= 2 && this.renVM.burnTxHash) {
            const selector =
                this.renVM.version >= 2
                    ? v2.resolveV2Contract({
                          asset: this.params.asset,
                          from: (this.params.from as unknown) as
                              | LockChain
                              | MintChain,
                          to: (this.params.to as unknown) as
                              | LockChain
                              | MintChain,
                      })
                    : resolveOutToken({
                          ...this.params,
                          from: this.params.from,
                      });

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
                this.renVM.version >= 2,
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
                this.renVM.version >= 2,
                this._state.logger,
            );

            const { gPubKey } = this._state;

            if (!gPubKey) {
                throw new Error(`BurnAndRelease object must be initialized.`);
            }

            return toURLBase64(
                this.renVM.burnTxHash({
                    selector: selector,
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
                    resolveOutToken({
                        ...this.params,
                        from: this.params.from,
                    }),
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
            fromBase64(this.txHash()),
        );
        this._state.queryTxResult = burnTransaction;
        return burnTransaction;
    };

    /**
     * submit queries RenVM for the status of the burn until the funds are
     * released.
     *
     * @returns {PromiEvent<BurnAndReleaseTransaction, { txHash: [string], status: [TxStatus] }>}
     */
    public release = (): PromiEvent<
        BurnAndReleaseTransaction,
        { txHash: [string]; status: [TxStatus] }
    > => {
        const promiEvent = newPromiEvent<
            BurnAndReleaseTransaction,
            { txHash: [string]; status: [TxStatus] }
        >();

        (async () => {
            if (!this.burnDetails && !this.params.txHash) {
                throw new Error("Must call `burn` before calling `release`");
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

                const selector =
                    this.renVM.version >= 2
                        ? v2.resolveV2Contract({
                              asset: this.params.asset,
                              from: (this.params.from as unknown) as
                                  | LockChain
                                  | MintChain,
                              to: (this.params.to as unknown) as
                                  | LockChain
                                  | MintChain,
                          })
                        : resolveOutToken({
                              ...this.params,
                              from: this.params.from,
                          });

                const { transaction, amount, to, nonce } = this.burnDetails;

                try {
                    let returnedTxHash: Buffer;

                    if (this.renVM.version >= 2) {
                        assertType<string>("string", { to });
                        // const selector = resolveV2Contract(selector);

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
                            this.renVM.version >= 2,
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
                            this.renVM.version >= 2,
                            this._state.logger,
                        );

                        returnedTxHash = await this.renVM.submitBurn({
                            selector,
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
                        });
                    } else {
                        returnedTxHash = await this.renVM.submitBurn({
                            selector,
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
                        });
                    }
                    if (txHash && !fromBase64(txHash).equals(returnedTxHash)) {
                        this._state.logger.warn(
                            `Unexpected txHash returned from RenVM. Received: ${toBase64(
                                returnedTxHash,
                            )}, expected: ${txHash}`,
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

            const response = await this.renVM.waitForTX<
                BurnAndReleaseTransaction
            >(
                fromBase64(txHash),
                (status) => {
                    promiEvent.emit("status", status);
                    this._state.logger.debug("transaction status:", status);
                },
                () => promiEvent._isCancelled(),
            );

            this.status = BurnAndReleaseStatus.Released;

            return response;
        })()
            .then(promiEvent.resolve)
            .catch(promiEvent.reject);

        return promiEvent;
    };
}
