import { isDefined } from "./common";
import { Chain, ChainTransaction } from "./interfaces/chain";
import { newPromiEvent, PromiEvent } from "./promiEvent";

// Taken from @renproject/utils. Todo: move txSubmitted to utils as well.
const SECONDS = 1000;
const sleep = async (ms: number): Promise<void> =>
    new Promise<void>((resolve) => setTimeout(resolve, ms));

export enum ChainTransactionStatus {
    Ready = "ready",
    Confirming = "confirming",
    Confirmed = "confirmed",

    FailedToSubmit = "failed-to-submit",
    ConfirmedWithError = "confirmed-with-error",
}

export interface ChainTransactionProgress {
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
    wait: () => PromiEvent<
        ChainTransaction,
        {
            status: [ChainTransactionProgress];
        }
    >;
    submit?: never;
}

export interface TxSubmitter {
    // extends TxWaiter
    chain: string;
    status: ChainTransactionProgress;
    wait: (target?: number) => PromiEvent<
        ChainTransaction,
        {
            status: [ChainTransactionProgress];
        }
    >;

    submit: (params?: { overrides?: any[]; config?: any }) => PromiEvent<
        ChainTransaction,
        {
            status: [ChainTransactionProgress];
        }
    >;
}

// export class StandardTransaction {
//     private _submit: (
//         promiEvent: PromiEvent<
//             ChainTransaction,
//             {
//                 status: [TransactionProgress];
//             }
//         >,
//     ) => Promise<ChainTransaction>;
//     private _confirmations: (
//         chainTransaction: ChainTransaction,
//     ) => Promise<number>;
//     private _getTarget: (chainTransaction: ChainTransaction) => Promise<number>;
//     private _target: number | undefined;

//     private _tx: ChainTransaction | undefined;

//     constructor({
//         submit,
//         confirmations,
//         target,
//     }: {
//         submit: (
//             promiEvent: PromiEvent<
//                 ChainTransaction,
//                 {
//                     status: [TransactionProgress];
//                 }
//             >,
//         ) => Promise<ChainTransaction>;
//         confirmations: (chainTransaction: ChainTransaction) => Promise<number>;
//         target: (chainTransaction: ChainTransaction) => Promise<number>;
//     }) {
//         this._submit = submit;
//         this._confirmations = confirmations;
//         this._getTarget = target;
//     }

//     private target = async (): Promise<number> => {
//         this._target = this._target || (await this.target());
//         return this._target;
//     };

//     status = async (): Promise<TransactionProgress> => {
//         const tx = this._tx;
//         if (!tx) {
//             throw new Error(`Must call ".submit" first.`);
//         }

//         const target = await this.target();
//         const confidence = await this._confirmations(this._tx!);
//         return {
//             status: TransactionStatus.Confirming,
//             transaction: tx,
//             target,
//             confirmations: confidence,
//         };
//     };

//     submit = (): PromiEvent<
//         ChainTransaction,
//         {
//             status: [TransactionProgress];
//         }
//     > => {
//         const promiEvent = newPromiEvent<
//             ChainTransaction,
//             {
//                 status: [TransactionProgress];
//             }
//         >();

//         async () => {
//             this._tx = await this._submit(promiEvent);
//             const target = await this.target();

//             promiEvent.emit("status", {
//                 status: TransactionStatus.Confirming,
//                 transaction: this._tx,
//                 target,
//                 confirmations: 0,
//             });

//             return this._tx;
//         };

//         return promiEvent;
//     };

//     wait = (): PromiEvent<
//         ChainTransaction,
//         {
//             status: [TransactionProgress];
//         }
//     > => {
//         const promiEvent = newPromiEvent<
//             ChainTransaction,
//             {
//                 status: [TransactionProgress];
//             }
//         >();

//         (async (): Promise<ChainTransaction> => {
//             const tx = this._tx;
//             if (!tx) {
//                 throw new Error(`Must call ".submit" first.`);
//             }

//             let currentConfidenceRatio = -1;
//             const target = await this.target();
//             while (true) {
//                 const confidence = await this._confirmations(tx);

//                 const confidenceRatio = target === 0 ? 1 : confidence / target;
//                 if (confidenceRatio > currentConfidenceRatio) {
//                     currentConfidenceRatio = confidenceRatio;
//                     promiEvent.emit("status", {
//                         status: TransactionStatus.Confirming,
//                         transaction: tx,
//                         target,
//                         confirmations: confidence,
//                     });
//                 }
//                 if (confidenceRatio >= 1) {
//                     break;
//                 }

//                 await sleep(15 * SECONDS);
//             }

//             return tx;
//         })()
//             .then(promiEvent.resolve)
//             .catch(promiEvent.reject);

//         return promiEvent;
//     };
// }

export class DefaultTxWaiter implements TxWaiter {
    private _chainTransaction: ChainTransaction;
    private _chain: Chain;
    private _target: number;

    public chain: string;
    public status: ChainTransactionProgress = {
        status: ChainTransactionStatus.Ready,
        target: 0,
    };

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
            ...this.status,
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
                    promiEvent.emit("status", {
                        status: ChainTransactionStatus.Confirming,
                        transaction: tx,
                        target: target,
                        confirmations: confidence,
                    });
                }
                if (confidenceRatio >= 1) {
                    this.status = {
                        ...this.status,
                        status: ChainTransactionStatus.Confirmed,
                    };
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

// export class EmptyTxWaiter implements TxWaiter {
//     public status: ChainTransactionProgress = {
//         status: ChainTransactionStatus.Confirmed,
//         confirmations: 0,
//         target: 0,
//     };

//     constructor() {
//     }

//     wait = (): PromiEvent<
//         ChainTransaction,
//         {
//             status: [ChainTransactionProgress];
//         }
//     > => {
//         const promiEvent = newPromiEvent<
//             ChainTransaction,
//             {
//                 status: [ChainTransactionProgress];
//             }
//         >();

//         (async (): Promise<ChainTransaction> => {
//             return
//         })()
//             .then(promiEvent.resolve)
//             .catch(promiEvent.reject);

//         return promiEvent;
//     };
// }
