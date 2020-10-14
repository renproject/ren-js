import {
    BurnAndReleaseParams,
    BurnDetails,
    BurnTransaction,
    DepositCommon,
    EventType,
    LockChain,
    Logger,
    LogLevel,
    MintChain,
    newPromiEvent,
    PromiEvent,
    RenNetwork,
    SimpleLogger,
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

export class BurnAndRelease<
    // tslint:disable-next-line: no-any
    Transaction = any,
    Deposit extends DepositCommon<Transaction> = DepositCommon<Transaction>,
    Asset extends string = string,
    Address = string
> {
    public queryTxResult: BurnTransaction | undefined;

    public renNetwork: RenNetwork | undefined;

    public readonly _params: BurnAndReleaseParams<
        Transaction,
        Deposit,
        Asset,
        Address
    >;
    public readonly _renVM: AbstractRenVMProvider;
    public readonly _logger: Logger;

    public _burnDetails: BurnDetails<Transaction> | undefined;

    constructor(
        _renVM: AbstractRenVMProvider,
        _params: BurnAndReleaseParams<Transaction, Deposit, Asset, Address>,
        _logger: Logger
    ) {
        this._logger = _logger;
        this._renVM = _renVM;
        this._params = _params; // processBurnAndReleaseParams(this.network, _params);

        this.validateParams();

        {
            // Debug log
            const { ...restOfParams } = this._params;
            this._logger.debug("burnAndRelease created:", restOfParams);
        }
    }

    private readonly validateParams = () => {
        assertObject(
            {
                from: "object",
                to: "object",
                transaction: "any | undefined",
                burnNonce: "string | number | undefined",
                contractCalls: "any[] | undefined",
                asset: "string",
                txHash: "string | undefined",
                nonce: "Buffer | string | undefined",
                tags: "string[] | undefined",
            },
            { params: this._params }
        );

        if (this._params.contractCalls) {
            this._params.contractCalls.map(contractCall => {
                assertType<string>("string", {
                    sendTo: contractCall.sendTo,
                    contractFn: contractCall.contractFn,
                });
            });
        }
    };

    public readonly initialize = async (): Promise<this> => {
        this.renNetwork =
            this.renNetwork || ((await this._renVM.getNetwork()) as RenNetwork);

        if (!this._params.from.renNetwork) {
            this._params.from.initialize(this.renNetwork);
        }
        if (!this._params.to.renNetwork) {
            this._params.to.initialize(this.renNetwork);
        }

        const burnPayload =
            this._params.to.burnPayload &&
            (await this._params.to.burnPayload());

        this._params.contractCalls =
            this._params.contractCalls ||
            (this._params.from.contractCalls &&
                (await this._params.from.contractCalls(
                    EventType.BurnAndRelease,
                    this._params.asset,
                    burnPayload
                )));

        return this;
    };

    /**
     * Read a burn reference from an Ethereum transaction - or submit a
     * transaction first if the transaction details have been provided.
     *
     * @param {TransactionConfig} [txConfig] Optionally override default options
     *        like gas.
     * @returns {(PromiEvent<BurnAndRelease, { [event: string]: any }>)}
     */
    public burn = (): PromiEvent<
        BurnAndRelease<Transaction, Deposit, Asset, Address>,
        // tslint:disable-next-line: no-any
        { [event: string]: any }
    > => {
        const promiEvent = newPromiEvent<
            BurnAndRelease<Transaction, Deposit, Asset, Address>,
            // tslint:disable-next-line: no-any
            { [event: string]: any }
        >();

        (async () => {
            if (this._params.txHash) {
                return this;
            }

            const {
                asset,
                transaction,
                burnNonce,
                contractCalls,
            } = this._params;

            this._burnDetails = await this._params.from.findBurnTransaction(
                asset,
                {
                    transaction,
                    burnNonce,
                    contractCalls,
                },
                (promiEvent as unknown) as EventEmitter,
                this._logger
            );

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
    public txHash = async (): Promise<string> => {
        const txHash = this._params.txHash;
        if (txHash) {
            return renVMHashToBase64(txHash);
        }

        if (!this._burnDetails) {
            throw new Error("Must call `burn` before calling `txHash`");
        }

        if (this._renVM.version >= 2 && this._renVM.burnTxHash) {
            const selector =
                this._renVM.version >= 2
                    ? v2.resolveV2Contract({
                          asset: this._params.asset,
                          from: (this._params.from as unknown) as
                              | LockChain
                              | MintChain,
                          to: (this._params.to as unknown) as
                              | LockChain
                              | MintChain,
                      })
                    : resolveOutToken(this._params);

            const { transaction, amount, to, nonce } = this._burnDetails;

            const asset = selector.split("/")[0];

            const gPubKey = await this._renVM.selectPublicKey(
                asset,
                this._logger
            );

            const payload = Buffer.from([]);
            const pHash = generatePHash([], this._logger);
            const { txid, txindex } = this._params.from.transactionRPCFormat(
                transaction,
                true
            );
            const nonceBuffer = new BN(nonce.toFixed()).toArrayLike(
                Buffer,
                "be",
                32
            );

            const nHash = generateNHash(
                nonceBuffer,
                txid,
                txindex,
                this._renVM.version >= 2,
                this._logger
            );
            const sHash = generateSHash(
                `${this._params.asset}/to${this._params.to.name}`
            );

            const gHash = generateGHash(
                [],
                "0x01caf724ea7f2032072510c4c428732bb3a49ba2f2",
                Ox(sHash),
                nonceBuffer,
                this._renVM.version >= 2,
                this._logger
            );

            return toURLBase64(
                await this._renVM.burnTxHash({
                    renContractOrSelector: selector,
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
                })
            );
        } else {
            return toBase64(
                generateBurnTxHash(
                    resolveOutToken(this._params),
                    this._burnDetails.nonce.toFixed(),
                    this._logger
                )
            );
        }
    };

    /**
     * queryTx requests the status of the burn from RenVM.
     */
    public queryTx = async (): Promise<BurnTransaction> => {
        this.queryTxResult = (await this._renVM.queryMintOrBurn(
            fromBase64(await this.txHash())
        )) as BurnTransaction;
        return this.queryTxResult;
    };

    /**
     * submit queries RenVM for the status of the burn until the funds are
     * released.
     *
     * @returns {PromiEvent<BurnTransaction, { txHash: [string], status: [TxStatus] }>}
     */
    public release = (): PromiEvent<
        BurnTransaction,
        { txHash: [string]; status: [TxStatus] }
    > => {
        const promiEvent = newPromiEvent<
            BurnTransaction,
            { txHash: [string]; status: [TxStatus] }
        >();

        (async () => {
            if (!this._burnDetails && !this._params.txHash) {
                throw new Error("Must call `burn` before calling `release`");
            }

            const txHash = await this.txHash();

            if (!this._params.txHash && this._burnDetails) {
                if (this._params.tags && this._params.tags.length > 1) {
                    throw new Error(
                        "Providing multiple tags is not supported yet."
                    );
                }
                const tags: [string] | [] =
                    this._params.tags && this._params.tags.length
                        ? [this._params.tags[0]]
                        : [];

                const selector =
                    this._renVM.version >= 2
                        ? v2.resolveV2Contract({
                              asset: this._params.asset,
                              from: (this._params.from as unknown) as
                                  | LockChain
                                  | MintChain,
                              to: (this._params.to as unknown) as
                                  | LockChain
                                  | MintChain,
                          })
                        : resolveOutToken(this._params);

                const { transaction, amount, to, nonce } = this._burnDetails;

                try {
                    let returnedTxHash: Buffer;

                    if (this._renVM.version >= 2) {
                        assertType<Buffer>("Buffer", { to });
                        // const selector = resolveV2Contract(renContract);

                        // TODO: Turn into function with tests.
                        const asset = selector.split("/")[0];

                        const gPubKey = await this._renVM.selectPublicKey(
                            asset,
                            this._logger
                        );

                        const payload = Buffer.from([]);
                        const pHash = generatePHash([], this._logger);
                        const {
                            txid,
                            txindex,
                        } = this._params.from.transactionRPCFormat(
                            transaction,
                            true
                        );
                        const nonceBuffer = new BN(nonce.toFixed()).toArrayLike(
                            Buffer,
                            "be",
                            32
                        );

                        const nHash = generateNHash(
                            nonceBuffer,
                            txid,
                            txindex,
                            this._renVM.version >= 2,
                            this._logger
                        );
                        const sHash = generateSHash(
                            `${this._params.asset}/to${this._params.to.name}`
                        );

                        const gHash = generateGHash(
                            [],
                            "0x01caf724ea7f2032072510c4c428732bb3a49ba2f2",
                            Ox(sHash),
                            nonceBuffer,
                            this._renVM.version >= 2,
                            this._logger
                        );

                        returnedTxHash = await this._renVM.submitBurn(
                            {
                                renContractOrSelector: selector,
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
                            },
                            tags
                        );
                    } else {
                        returnedTxHash = await this._renVM.submitBurn(
                            {
                                renContract: selector,
                                burnNonce: nonce,
                            },
                            tags
                        );
                    }
                    if (txHash && toBase64(returnedTxHash) !== txHash) {
                        this._logger.warn(
                            `Unexpected txHash returned from RenVM. Received: ${toBase64(
                                returnedTxHash
                            )}, expected: ${txHash}`
                        );
                    }
                } catch (error) {
                    // TODO: Check against already being submitted.
                    throw error;
                }
            }

            // const txHash = await this.renVMNetwork.submitTokenFromEthereum(this.params.sendToken, burnNonce);
            promiEvent.emit("txHash", txHash);
            this._logger.debug("txHash:", txHash);

            return await this._renVM.waitForTX<BurnTransaction>(
                fromBase64(txHash),
                status => {
                    promiEvent.emit("status", status);
                    this._logger.debug("transaction status:", status);
                },
                () => promiEvent._isCancelled()
            );
        })()
            .then(promiEvent.resolve)
            .catch(promiEvent.reject);

        return promiEvent;
    };
}
