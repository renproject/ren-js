import {
    BurnAndReleaseParams,
    BurnTransaction,
    EventType,
    Logger,
    RenNetwork,
    TxStatus,
} from "@renproject/interfaces";
import { AbstractRenVMProvider } from "@renproject/rpc";
import {
    extractError,
    fromBase64,
    generateBurnTxHash,
    ignorePromiEventError,
    newPromiEvent,
    PromiEvent,
    resolveOutToken,
    txHashToBase64,
} from "@renproject/utils";
import BigNumber from "bignumber.js";
import { EventEmitter } from "events";

export class BurnAndRelease {
    public queryTxResult: BurnTransaction | undefined;

    public renNetwork: RenNetwork | undefined;

    private readonly params: BurnAndReleaseParams;
    private readonly renVM: AbstractRenVMProvider;
    private readonly logger: Logger;

    constructor(
        _renVM: AbstractRenVMProvider,
        _params: BurnAndReleaseParams,
        _logger: Logger
    ) {
        this.logger = _logger;
        this.renVM = _renVM;
        this.params = _params; // processBurnAndReleaseParams(this.network, _params);

        {
            // Debug log
            const { ...restOfParams } = this.params;
            this.logger.debug("burnAndRelease created", restOfParams);
        }
    }

    public readonly initialize = async () => {
        this.renNetwork =
            this.renNetwork || ((await this.renVM.getNetwork()) as RenNetwork);

        if (!this.params.from.renNetwork) {
            this.params.from.initialize(this.renNetwork);
        }
        if (!this.params.to.renNetwork) {
            this.params.to.initialize(this.renNetwork);
        }

        const burnPayload =
            this.params.to.burnPayload && (await this.params.to.burnPayload());

        this.params.contractCalls =
            this.params.contractCalls ||
            (this.params.from.contractCalls &&
                (await this.params.from.contractCalls(
                    EventType.BurnAndRelease,
                    this.params.asset,
                    burnPayload
                )));
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
            if (this.params.txHash) {
                return this;
            }

            this.params.burnReference = await this.params.from.findBurnTransaction(
                this.params,
                (promiEvent as unknown) as EventEmitter,
                this.logger,
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
                    this.logger.error(extractError(error));
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
        const txHash = this.params.txHash;
        if (txHash) {
            return txHashToBase64(txHash);
        }

        if (!this.params.burnReference && this.params.burnReference !== 0) {
            throw new Error("Must call `burn` before calling `txHash`");
        }
        const burnReference = new BigNumber(
            this.params.burnReference
        ).toFixed();
        return generateBurnTxHash(
            resolveOutToken(this.params),
            burnReference,
            this.logger
        );
    };

    /**
     * queryTx requests the status of the burn from RenVM.
     */
    public queryTx = async (): Promise<BurnTransaction> => {
        this.queryTxResult = (await this.renVM.queryMintOrBurn(
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
            const { burnReference } = this.params;
            if (!this.params.txHash && !burnReference && burnReference !== 0) {
                throw new Error("Must call `burn` before calling `release`");
            }

            const txHash = this.txHash();

            if (this.params.tags && this.params.tags.length > 1) {
                throw new Error(
                    "Providing multiple tags is not supported yet."
                );
            }
            const tags: [string] | [] =
                this.params.tags && this.params.tags.length
                    ? [this.params.tags[0]]
                    : [];

            if (burnReference || burnReference === 0) {
                await this.renVM.submitBurn(
                    resolveOutToken(this.params),
                    new BigNumber(0),
                    "",
                    "",
                    new BigNumber(burnReference),
                    tags
                );
            }

            // const txHash = await this.renVMNetwork.submitTokenFromEthereum(this.params.sendToken, burnReference);
            promiEvent.emit("txHash", txHash);
            this.logger.debug("txHash", txHash);

            return await this.renVM.waitForTX<BurnTransaction>(
                Buffer.from(txHash, "base64"),
                (status) => {
                    promiEvent.emit("status", status);
                    this.logger.debug("Transaction Status", status);
                },
                () => promiEvent._isCancelled()
            );
        })()
            .then(promiEvent.resolve)
            .catch(promiEvent.reject);

        return promiEvent;
    };
}
