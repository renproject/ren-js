import {
    BurnAndReleaseParams,
    BurnTransaction,
    EventType,
    LockChain,
    Logger,
    MintChain,
    newPromiEvent,
    PromiEvent,
    RenNetwork,
    TxStatus,
} from "@renproject/interfaces";
import { AbstractRenVMProvider, v2 } from "@renproject/rpc";
import {
    assertObject,
    assertType,
    extractError,
    fromBase64,
    generateBurnTxHash,
    ignorePromiEventError,
    renVMHashToBase64,
    resolveOutToken,
    toBase64,
} from "@renproject/utils";
import BigNumber from "bignumber.js";
import { EventEmitter } from "events";

export class BurnAndRelease {
    public queryTxResult: BurnTransaction | undefined;

    public renNetwork: RenNetwork | undefined;

    public readonly _params: BurnAndReleaseParams;
    public readonly _renVM: AbstractRenVMProvider;
    public readonly _logger: Logger;

    constructor(
        _renVM: AbstractRenVMProvider,
        _params: BurnAndReleaseParams,
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
                ethereumTxHash: "string | undefined",
                burnReference: "string | number | undefined",
                contractCalls: "any[] | undefined",
                asset: "string",
                txHash: "string | undefined",
                nonce: "Buffer | string | undefined",
                tags: "string[] | undefined",
            },
            { params: this._params }
        );

        if (this._params.contractCalls) {
            this._params.contractCalls.map((contractCall) => {
                assertType("string", {
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
    public burn = (
        // tslint:disable-next-line: no-any
        txConfig?: any
        // tslint:disable-next-line: no-any
    ): PromiEvent<BurnAndRelease, { [event: string]: any }> => {
        const promiEvent = newPromiEvent<
            BurnAndRelease,
            // tslint:disable-next-line: no-any
            { [event: string]: any }
        >();

        (async () => {
            if (this._params.txHash) {
                return this;
            }

            this._params.burnReference = await this._params.from.findBurnTransaction(
                this._params,
                (promiEvent as unknown) as EventEmitter,
                this._logger,
                txConfig
            );

            return this;
        })()
            .then(promiEvent.resolve)
            .catch(promiEvent.reject);

        // TODO: Look into why .catch isn't being called on tx
        promiEvent.on("error", (error) => {
            try {
                if (ignorePromiEventError(error)) {
                    this._logger.error(extractError(error));
                    return;
                }
            } catch (_error) {
                /* Ignore _error */
            }
            promiEvent.reject(error);
        });

        return promiEvent;
    };

    /**
     * txHash calculates the RenVM transaction hash for the burn. This is
     * used to track the progress of the release in RenVM.
     */
    public txHash = (): string => {
        const txHash = this._params.txHash;
        if (txHash) {
            return renVMHashToBase64(txHash);
        }

        if (!this._params.burnReference && this._params.burnReference !== 0) {
            throw new Error("Must call `burn` before calling `txHash`");
        }
        const burnReference = new BigNumber(
            this._params.burnReference
        ).toFixed();
        return toBase64(
            generateBurnTxHash(
                resolveOutToken(this._params),
                burnReference,
                this._logger
            )
        );
    };

    /**
     * queryTx requests the status of the burn from RenVM.
     */
    public queryTx = async (): Promise<BurnTransaction> => {
        this.queryTxResult = (await this._renVM.queryMintOrBurn(
            fromBase64(this.txHash())
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
            const { burnReference } = this._params;
            if (!this._params.txHash && !burnReference && burnReference !== 0) {
                throw new Error("Must call `burn` before calling `release`");
            }

            const txHash = this.txHash();

            if (this._params.tags && this._params.tags.length > 1) {
                throw new Error(
                    "Providing multiple tags is not supported yet."
                );
            }
            const tags: [string] | [] =
                this._params.tags && this._params.tags.length
                    ? [this._params.tags[0]]
                    : [];

            if (burnReference || burnReference === 0) {
                const selector =
                    this._renVM.version >= 2
                        ? v2.resolveV2Contract({
                              asset: this._params.asset,
                              from: (this._params.from as unknown) as
                                  | LockChain
                                  | MintChain,
                              to: this._params.to,
                          })
                        : resolveOutToken(this._params);

                const returnedTxHash = await this._renVM.submitBurn(
                    selector,
                    new BigNumber(0),
                    "",
                    "",
                    new BigNumber(burnReference),
                    tags
                );
                if (txHash && toBase64(returnedTxHash) !== txHash) {
                    this._logger.warn(
                        `Unexpected txHash returned from RenVM. Received: ${toBase64(
                            returnedTxHash
                        )}, expected: ${txHash}`
                    );
                }
            }

            // const txHash = await this.renVMNetwork.submitTokenFromEthereum(this.params.sendToken, burnReference);
            promiEvent.emit("txHash", txHash);
            this._logger.debug("txHash:", txHash);

            return await this._renVM.waitForTX<BurnTransaction>(
                fromBase64(txHash),
                (status) => {
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
