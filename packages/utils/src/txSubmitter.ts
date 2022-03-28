import { isDefined, newPromiEvent } from "./internal/common";
import { sleep } from "./internal/sleep";
import { Chain, ChainTransaction, SyncOrPromise } from "./types/chain";
import {
    eventEmitter,
    EventEmitterTyped,
    PromiEvent,
} from "./types/eventEmitter";

export enum ChainTransactionStatus {
    Ready = "ready",
    Confirming = "confirming",
    Done = "done",
    Reverted = "reverted",
}

export interface ChainTransactionProgress {
    chain: string;
    status: ChainTransactionStatus;
    target: number;
    confirmations?: number;
    transaction?: ChainTransaction;

    /**
     * If the status is Reverted, `revertReason` should be set to accompanying
     * error message if there is one.
     */
    revertReason?: string;

    /**
     * If the transaction is replaced/sped-up, `replaced` should be set to the
     * old transaction details.
     */
    replaced?: ChainTransaction;
}

export interface TxWaiter<
    Progress extends ChainTransactionProgress = ChainTransactionProgress,
> {
    // The name of the transaction's chain.
    chain: string;

    // The transaction's current progress. This will only get updated while
    // `submit` or `wait` are being called.
    progress: Progress;

    // The event emitter is also returned by `submit` and `wait`.
    eventEmitter: EventEmitterTyped<{
        progress: [Progress];
    }>;

    /**
     * Submit the transaction to the chain.
     */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    submit?(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        params?: { overrides?: any[] },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        txConfig?: any,
    ): PromiEvent<
        Progress,
        {
            progress: [Progress];
        }
    >;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    export?(params?: { overrides?: any[]; txConfig?: any }): SyncOrPromise<any>;

    /**
     * Wait for the required finality / number of confirmations.
     * The target can optionally be overridden.
     */
    wait(targetOverride?: number): PromiEvent<
        Progress,
        {
            progress: [Progress];
        }
    >;
}

/**
 * TxSubmitter is a standard interface across chains to allow for submitting
 * transactions and waiting for finality. The `wait` and `submit` methods
 * emit a "progress" event which is standard across chains.
 */
export interface TxSubmitter<
    Progress extends ChainTransactionProgress = ChainTransactionProgress,
    TxConfig = {},
    TxExport = {},
> extends TxWaiter<Progress> {
    /**
     * Submit the transaction to the chain.
     */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    submit(params?: { overrides?: any[]; txConfig?: TxConfig }): PromiEvent<
        Progress,
        {
            progress: [Progress];
        }
    >;

    /**
     * Export the raw unsigned transaction that would be signed/submitted by
     * `submit`.
     */
    export(params?: {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        overrides?: any[];
        txConfig?: TxConfig;
    }): SyncOrPromise<TxExport>;
}

/**
 * Allow overwriting the `transaction` field of a TxWaiter instance.
 * This is used so the same TxWaiter instance can paired with different
 * InputChainTransaction objects that are all extensions of the TxWaiter's
 * original ChainTransaction object.
 */
export class TxWaiterProxy {
    private _txWaiter: TxWaiter;
    private _transaction: ChainTransaction;
    private _eventEmitter: EventEmitterTyped<{
        progress: [ChainTransactionProgress];
    }>;

    public constructor(txWaiter: TxWaiter, transaction: ChainTransaction) {
        this._txWaiter = txWaiter;
        this._transaction = transaction;
        this._eventEmitter = eventEmitter();

        txWaiter.eventEmitter.on("progress", (progress) => {
            this._eventEmitter.emit("progress", {
                ...progress,
                transaction: this._transaction,
            });
        });

        return new Proxy(this, {
            // eslint-disable-next-line @typescript-eslint/unbound-method
            get: this.proxyHandler,
        });
    }

    public _wait(target?: number): PromiEvent<
        ChainTransactionProgress,
        {
            progress: [ChainTransactionProgress];
        }
    > {
        const promiEvent = newPromiEvent<
            ChainTransactionProgress,
            {
                progress: [ChainTransactionProgress];
            }
        >(this._eventEmitter);

        (async (): Promise<ChainTransactionProgress> => {
            return await this._txWaiter.wait(target);
        })()
            .then(promiEvent.resolve)
            .catch(promiEvent.reject);

        return promiEvent;
    }

    /**
     * Proxy handler to call the promise or eventEmitter methods
     */
    public proxyHandler(target: TxWaiterProxy, name: string): unknown {
        if (name === "transaction") {
            return target._transaction;
        }

        if (name === "progress") {
            return {
                ...target._txWaiter[name],
                transaction: target._transaction,
            };
        }

        if (name === "eventEmitter") {
            return target._eventEmitter;
        }

        if (name === "wait") {
            return target._wait.bind(target);
        }

        return target._txWaiter[name];
    }
}

/**
 * The DefaultTxWaiter is a helper for when a chain transaction has already
 * been submitted.
 */
export class DefaultTxWaiter implements TxWaiter {
    private _chain: Chain;

    public chain: string;
    public progress: ChainTransactionProgress;
    public eventEmitter: EventEmitterTyped<{
        progress: [ChainTransactionProgress];
    }>;
    private _onFirstProgress?: (tx: ChainTransaction) => SyncOrPromise<void>;

    private updateProgress(progress: Partial<ChainTransactionProgress>) {
        this.progress = {
            ...this.progress,
            ...progress,
        };
        this.eventEmitter.emit("progress", this.progress);
    }

    /**
     * Requires a submitted chainTransaction, a chain object and the target
     * confirmation count.
     */
    public constructor({
        chainTransaction,
        chain,
        target,
        onFirstProgress,
    }: {
        chainTransaction?: ChainTransaction;
        chain: Chain;
        target: number;
        onFirstProgress?: (tx: ChainTransaction) => SyncOrPromise<void>;
    }) {
        this._chain = chain;
        this._onFirstProgress = onFirstProgress;

        this.chain = chain.chain;
        this.eventEmitter = eventEmitter();

        this.progress = {
            chain: chain.chain,
            status:
                chainTransaction && chainTransaction.txid === ""
                    ? ChainTransactionStatus.Done
                    : ChainTransactionStatus.Confirming,
            target,
            ...(chainTransaction ? { transaction: chainTransaction } : {}),
        };
    }

    /**
     * The transaction can be set at a later point. This is for situations where
     * its known that a transaction will already have been submitted, but its
     * hash isn't available yet. For example, a release transaction submitted
     * by RenVM.
     */
    public setTransaction(chainTransaction?: ChainTransaction): void {
        this.updateProgress({
            transaction: chainTransaction,
            status:
                chainTransaction && chainTransaction.txid === ""
                    ? ChainTransactionStatus.Done
                    : ChainTransactionStatus.Confirming,
        });
    }

    public wait(target?: number): PromiEvent<
        ChainTransactionProgress,
        {
            progress: [ChainTransactionProgress];
        }
    > {
        const promiEvent = newPromiEvent<
            ChainTransactionProgress,
            {
                progress: [ChainTransactionProgress];
            }
        >(this.eventEmitter);

        (async (): Promise<ChainTransactionProgress> => {
            const tx = this.progress.transaction;
            if (!tx) {
                throw new Error(`Must call ".submit" first.`);
            }

            target = isDefined(target) ? target : this.progress.target;

            // If the txid is missing, then assume that the transaction
            // is confirmed. In some situations its known that a transaction
            // has taken place (e.g. by looking at the current state of the
            // chain) but there's no way of finding the transaction's details.
            // In this case, the txid will be set to "".
            if (tx.txid === "") {
                this.updateProgress({
                    ...this.progress,
                    confirmations: target,
                    status: ChainTransactionStatus.Done,
                });
                return this.progress;
            }

            let currentConfidenceRatio = -1;
            while (true) {
                try {
                    const confidence = (
                        await this._chain.transactionConfidence(tx)
                    ).toNumber();

                    const confidenceRatio =
                        target === 0 ? 1 : confidence / target;

                    // The confidence has increased.
                    if (confidenceRatio > currentConfidenceRatio) {
                        if (this._onFirstProgress) {
                            await this._onFirstProgress(tx);
                            this._onFirstProgress = undefined;
                        }
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
                } catch (error: unknown) {
                    console.error(error);
                }
                await sleep(15 * sleep.SECONDS);
            }

            return this.progress;
        })()
            .then(promiEvent.resolve)
            .catch(promiEvent.reject);

        return promiEvent;
    }
}
