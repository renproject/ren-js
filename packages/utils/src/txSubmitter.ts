import { isDefined, SECONDS, sleep } from "./common";
import { Chain, ChainTransaction } from "./interfaces/chain";
import { newPromiEvent, PromiEvent } from "./promiEvent";

export enum ChainTransactionStatus {
    Ready = "ready",
    Confirming = "confirming",
    Confirmed = "confirmed",

    FailedToSubmit = "failed-to-submit",
    ConfirmedWithError = "confirmed-with-error",
}

export interface ChainTransactionProgress {
    chain: string;
    status: ChainTransactionStatus;
    target: number;
    confirmations?: number;
    transaction?: ChainTransaction;

    replaced?: {
        previousTransaction: ChainTransaction;
    };
    error?: Error;
}

export interface TxWaiter {
    chain: string;
    status: ChainTransactionProgress;

    submit?: never;

    wait: () => PromiEvent<
        ChainTransaction,
        {
            status: [ChainTransactionProgress];
        }
    >;
}

/**
 * TxSubmitter is a standard interface across chains to allow for submitting
 * transactions and waiting for finality. The `wait` and `submit` methods
 * emit a "status" event which is standard across chains.
 */
export interface TxSubmitter<
    SubmitChainTransaction extends ChainTransaction = ChainTransaction,
    WaitChainTransaction extends ChainTransaction = SubmitChainTransaction,
> {
    // extends TxWaiter
    chain: string;
    status: ChainTransactionProgress;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    submit: (params?: { overrides?: any[]; config?: any }) => PromiEvent<
        SubmitChainTransaction,
        {
            status: [ChainTransactionProgress];
        }
    >;

    wait: (target?: number) => PromiEvent<
        WaitChainTransaction,
        {
            status: [ChainTransactionProgress];
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
        ChainTransaction,
        {
            status: [ChainTransactionProgress];
        }
    > => {
        const promiEvent = newPromiEvent<
            ChainTransaction,
            {
                status: [ChainTransactionProgress];
            }
        >();

        (async (): Promise<ChainTransaction> => {
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

                this.status = {
                    ...this.status,
                    confirmations: confidence,
                };

                const confidenceRatio = target === 0 ? 1 : confidence / target;
                if (confidenceRatio > currentConfidenceRatio) {
                    currentConfidenceRatio = confidenceRatio;
                    this.status = {
                        ...this.status,
                        confirmations: confidence,
                    };
                    promiEvent.emit("status", this.status);
                }
                if (confidenceRatio >= 1) {
                    this.status = {
                        ...this.status,
                        status: ChainTransactionStatus.Confirmed,
                    };
                    promiEvent.emit("status", this.status);
                    break;
                }

                await sleep(15 * SECONDS);
            }

            return tx;
        })()
            .then(promiEvent.resolve)
            .catch(promiEvent.reject);

        return promiEvent;
    };
}
