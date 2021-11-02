import { isDefined, SECONDS, sleep } from "./common";
import { Chain, ChainTransaction } from "./interfaces/chain";
import { eventEmitter, EventEmitterTyped } from "./interfaces/eventEmitter";
import { newPromiEvent, PromiEvent } from "./promiEvent";

export enum ChainTransactionStatus {
    Ready = "ready",
    Confirming = "confirming",
    Confirmed = "confirmed",
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
    chain: string;
    status: Progress;
    eventEmitter: EventEmitterTyped<{
        status: [Progress];
    }>;

    submit?: never;

    wait: () => PromiEvent<
        Progress,
        {
            status: [Progress];
        }
    >;
}

/**
 * TxSubmitter is a standard interface across chains to allow for submitting
 * transactions and waiting for finality. The `wait` and `submit` methods
 * emit a "status" event which is standard across chains.
 */
export interface TxSubmitter<
    Progress extends ChainTransactionProgress = ChainTransactionProgress,
> {
    // extends TxWaiter
    chain: string;
    status: Progress;
    eventEmitter: EventEmitterTyped<{
        status: [Progress];
    }>;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    submit: (params?: { overrides?: any[]; config?: any }) => PromiEvent<
        Progress,
        {
            status: [Progress];
        }
    >;
    wait: (target?: number) => PromiEvent<
        Progress,
        {
            status: [Progress];
        }
    >;
}

/**
 * The DefaultTxWaiter is a helper for when a chain transaction has already
 * been submitted.
 */
export class DefaultTxWaiter implements TxWaiter {
    private _chainTransaction: ChainTransaction;
    private _chain: Chain;
    private _target: number;

    public chain: string;
    public status: ChainTransactionProgress;
    public eventEmitter: EventEmitterTyped<{
        status: [ChainTransactionProgress];
    }>;

    private updateStatus = (status: Partial<ChainTransactionProgress>) => {
        this.status = {
            ...this.status,
            ...status,
        };
        this.eventEmitter.emit("status", this.status);
    };

    /**
     * Requires a submitted chainTransaction, a chain object and the target
     * confirmation count.
     */
    constructor({
        chainTransaction,
        chain,
        target,
    }: {
        chainTransaction: ChainTransaction;
        chain: Chain;
        target: number;
    }) {
        this._chainTransaction = chainTransaction;
        this._chain = chain;
        this._target = target;

        this.chain = chain.chain;
        this.eventEmitter = eventEmitter();

        this.status = {
            chain: chain.chain,
            transaction: chainTransaction,
            status: ChainTransactionStatus.Confirming,
            target,
        };
    }

    wait = (
        target?: number,
    ): PromiEvent<
        ChainTransactionProgress,
        {
            status: [ChainTransactionProgress];
        }
    > => {
        const promiEvent = newPromiEvent<
            ChainTransactionProgress,
            {
                status: [ChainTransactionProgress];
            }
        >(this.eventEmitter);

        (async (): Promise<ChainTransactionProgress> => {
            const tx = this._chainTransaction;
            if (!tx) {
                throw new Error(`Must call ".submit" first.`);
            }

            target = isDefined(target) ? target : this._target;

            let currentConfidenceRatio = -1;
            while (true) {
                const confidence = (
                    await this._chain.transactionConfidence(
                        this._chainTransaction,
                    )
                ).toNumber();

                const confidenceRatio = target === 0 ? 1 : confidence / target;

                // The confidence has increased.
                if (confidenceRatio > currentConfidenceRatio) {
                    if (confidenceRatio >= 1) {
                        // Done.
                        this.updateStatus({
                            ...this.status,
                            status: ChainTransactionStatus.Confirmed,
                        });
                        break;
                    } else {
                        // Update status.
                        currentConfidenceRatio = confidenceRatio;
                        this.updateStatus({
                            ...this.status,
                            confirmations: confidence,
                        });
                    }
                }
                await sleep(15 * SECONDS);
            }

            return this.status;
        })()
            .then(promiEvent.resolve)
            .catch(promiEvent.reject);

        return promiEvent;
    };
}
