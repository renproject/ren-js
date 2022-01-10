import { isDefined, newPromiEvent, sleep } from "./internal/common";
import { Chain, ChainTransaction } from "./types/chain";
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
    submit?(params?: { overrides?: any[] }): PromiEvent<
        Progress,
        {
            progress: [Progress];
        }
    >;

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
    TxConfig extends any = {},
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
}

/**
 * The DefaultTxWaiter is a helper for when a chain transaction has already
 * been submitted.
 */
export class DefaultTxWaiter implements TxWaiter {
    private _chainTransaction?: ChainTransaction;
    private _chain: Chain;

    public chain: string;
    public progress: ChainTransactionProgress;
    public eventEmitter: EventEmitterTyped<{
        progress: [ChainTransactionProgress];
    }>;

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
    }: {
        chainTransaction?: ChainTransaction;
        chain: Chain;
        target: number;
    }) {
        this._chainTransaction = chainTransaction;
        this._chain = chain;

        this.chain = chain.chain;
        this.eventEmitter = eventEmitter();

        this.progress = {
            chain: chain.chain,
            status: ChainTransactionStatus.Confirming,
            target,
            ...(chainTransaction ? { transaction: chainTransaction } : {}),
        };
    }

    public setTransaction(chainTransaction?: ChainTransaction): void {
        this._chainTransaction = chainTransaction;
        this.updateProgress({
            transaction: chainTransaction,
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
            const tx = this._chainTransaction;
            if (!tx) {
                throw new Error(`Must call ".submit" first.`);
            }

            target = isDefined(target) ? target : this.progress.target;

            let currentConfidenceRatio = -1;
            while (true) {
                const confidence = (
                    await this._chain.transactionConfidence(tx)
                ).toNumber();

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
                await sleep(15 * sleep.SECONDS);
            }

            return this.progress;
        })()
            .then(promiEvent.resolve)
            .catch(promiEvent.reject);

        return promiEvent;
    }
}
