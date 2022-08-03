import {
    ChainTransaction,
    ChainTransactionProgress,
    ChainTransactionStatus,
    defaultLogger,
    eventEmitter,
    EventEmitterTyped,
    Logger,
    PromiEvent,
    SyncOrPromise,
    TxSubmitter,
    utils,
} from "@renproject/utils";
import {
    Connection,
    sendAndConfirmRawTransaction,
    Transaction,
} from "@solana/web3.js";
import base58 from "bs58";

import { SolanaSigner } from "./types/types";
import { txHashToBytes } from "./utils";

export class SolanaTxWaiter
    implements TxSubmitter<ChainTransactionProgress, {}, string>
{
    private _getTransaction: () => Promise<{
        transaction: Transaction;
        nonce?: number;
    }>;
    private _provider: Connection;
    private _getSigner: () => SolanaSigner | undefined;
    private _onReceipt?: (
        signature: string,
        nonce?: number,
    ) => SyncOrPromise<void>;
    private _findExistingTransaction?: () => Promise<
        ChainTransaction | undefined
    >;
    private _transactionExplorerLink?: (
        params: Partial<ChainTransaction> &
            ({ txid: string } | { txHash: string }),
    ) => string | undefined;
    private _logger: Logger;

    public chain: string;
    public progress: ChainTransactionProgress;
    public eventEmitter: EventEmitterTyped<{
        progress: [ChainTransactionProgress];
    }>;

    private updateProgress = (
        progress: Partial<ChainTransactionProgress>,
    ): ChainTransactionProgress => {
        this.progress = {
            ...this.progress,
            ...progress,
        };
        this.eventEmitter.emit("progress", this.progress);
        return this.progress;
    };

    /**
     * Requires a submitted chainTransaction, a chain object and the target
     * confirmation count.
     */
    public constructor({
        chain,
        target,
        provider,
        getSigner,
        getTransaction,
        onReceipt,
        findExistingTransaction,
        transactionExplorerLink,
        logger,
    }: {
        chain: string;
        target: number;
        provider: Connection;
        getSigner: () => SolanaSigner | undefined;
        getTransaction: () => Promise<{
            transaction: Transaction;
            nonce?: number;
        }>;
        onReceipt?: (signature: string, nonce?: number) => SyncOrPromise<void>;
        findExistingTransaction?: () => Promise<ChainTransaction | undefined>;
        transactionExplorerLink?: (
            params: Partial<ChainTransaction> &
                ({ txid: string } | { txHash: string }),
        ) => string | undefined;
        logger?: Logger;
    }) {
        this._getTransaction = getTransaction;
        this.chain = chain;
        this._provider = provider;
        this._getSigner = getSigner;
        this._onReceipt = onReceipt;
        this._findExistingTransaction = findExistingTransaction;
        this._transactionExplorerLink = transactionExplorerLink;
        this._logger = logger || defaultLogger;

        this.eventEmitter = eventEmitter();

        this.progress = {
            chain,
            target,
            status: ChainTransactionStatus.Ready,
        };
    }

    /**
     * Export the unsigned transaction details.
     *
     * @returns The Solana message that needs to be signed and submitted,
     * serialized as a base58 string.
     *
     * @example
     * // Export transaction
     * const exportedTransaction = await tx.out.export();
     *
     * // Complete transaction
     * const message = Message.from(exportedTransaction);
     * const tx = Transaction.populate(message);
     * const signed = await signer.signTransaction(tx);
     * const confirmedSignature = await sendAndConfirmRawTransaction(
     *     provider,
     *     signed.serialize(),
     * );
     */
    public export = async (): Promise<string> => {
        return base58.encode(
            (await this._getTransaction()).transaction.serializeMessage(),
        );
    };

    public setTransaction = (
        chainTransaction: ChainTransaction,
    ): ChainTransactionProgress => {
        return this.updateProgress({
            status: ChainTransactionStatus.Done,
            confirmations: this.progress.target,
            target: this.progress.target,
            transaction: chainTransaction,
        });
    };

    public submit = (): PromiEvent<
        ChainTransactionProgress,
        {
            progress: [ChainTransactionProgress];
        }
    > => {
        const promiEvent = utils.newPromiEvent<
            ChainTransactionProgress,
            {
                progress: [ChainTransactionProgress];
            }
        >(this.eventEmitter);

        (async (): Promise<ChainTransactionProgress> => {
            if (this._findExistingTransaction && this._provider) {
                const existingTransaction =
                    await this._findExistingTransaction();

                if (existingTransaction) {
                    this.updateProgress({
                        status: ChainTransactionStatus.Done,
                        confirmations: this.progress.target,
                        target: this.progress.target,
                        transaction: existingTransaction,
                    });
                    return this.progress;
                }
            }

            const { transaction, nonce } = await this._getTransaction();

            // sendAndConfirmRawTransaction already calls simulate.
            const simulationResult = await utils.tryNTimes(
                async () =>
                    this._provider.simulateTransaction(
                        transaction.compileMessage(),
                    ),
                5,
            );
            if (simulationResult.value.err) {
                throw new Error(
                    "transaction simulation failed: " +
                        JSON.stringify(simulationResult),
                );
            }

            const signer = this._getSigner();
            if (!signer) {
                throw new Error(`Must connect ${this.chain} signer.`);
            }

            const signed = await signer.signTransaction(transaction);
            if (!signed.signature) {
                throw new Error("failed to sign");
            }

            // Should be the same as `signature`.
            const confirmedSignature = await sendAndConfirmRawTransaction(
                this._provider,
                signed.serialize(),
                { commitment: "confirmed" },
            );

            if (this._onReceipt) {
                try {
                    await this._onReceipt(confirmedSignature, nonce);
                } catch (error) {
                    this._logger.error(error);
                }
            }

            this.updateProgress({
                status: ChainTransactionStatus.Confirming,
                transaction: {
                    chain: this.progress.chain,
                    txHash: confirmedSignature,
                    txid: utils.toURLBase64(txHashToBytes(confirmedSignature)),
                    txindex: "0",
                    explorerLink:
                        (this._transactionExplorerLink &&
                            this._transactionExplorerLink({
                                txHash: confirmedSignature,
                            })) ||
                        "",
                },
            });

            return this.progress;
        })()
            .then(promiEvent.resolve)
            .catch(promiEvent.reject);

        return promiEvent;
    };

    public wait = (
        target?: number,
    ): PromiEvent<
        ChainTransactionProgress,
        {
            progress: [ChainTransactionProgress];
        }
    > => {
        const promiEvent = utils.newPromiEvent<
            ChainTransactionProgress,
            {
                progress: [ChainTransactionProgress];
            }
        >(this.eventEmitter);

        (async (): Promise<ChainTransactionProgress> => {
            if (!this.progress.transaction) {
                throw new Error(`Must call ".submit" first.`);
            }

            if (
                this.progress.transaction.txid === "" &&
                this.progress.status === ChainTransactionStatus.Done
            ) {
                return this.progress;
            }

            target = utils.isDefined(target) ? target : this.progress.target;

            let currentConfidenceRatio = -1;
            while (true) {
                const tx = await this._provider.getConfirmedTransaction(
                    String(this.progress.transaction.txHash),
                );

                const currentSlot = await this._provider.getSlot();
                const confidence = tx && tx.slot ? currentSlot - tx.slot : 0;

                const confidenceRatio = target === 0 ? 1 : confidence / target;

                // The confidence has increased.
                if (confidenceRatio > currentConfidenceRatio) {
                    if (confidenceRatio >= 1) {
                        // Done.
                        this.updateProgress({
                            ...this.progress,
                            confirmations: confidence,
                            status: ChainTransactionStatus.Done,
                        });
                        break;
                    } else {
                        // Update progress.
                        currentConfidenceRatio = confidenceRatio;
                        this.updateProgress({
                            ...this.progress,
                            confirmations: confidence,
                        });
                    }
                }
                await utils.sleep(15 * utils.sleep.SECONDS);
            }

            return this.progress;
        })()
            .then(promiEvent.resolve)
            .catch(promiEvent.reject);

        return promiEvent;
    };
}
