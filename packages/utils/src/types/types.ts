export type UrlBase64String = string;
export type HexString = string;

export enum TxStatus {
    // TxStatusNil is used for transactions that have not been seen, or are
    // otherwise unknown.
    TxStatusNil = "nil",
    // TxStatusConfirming is used for transactions that are currently waiting
    // for their underlying blockchain transactions to be confirmed.
    TxStatusConfirming = "confirming",
    // TxStatusPending is used for transactions that are waiting for consensus
    // to be reached on when the transaction should be executed.
    TxStatusPending = "pending",
    // TxStatusExecuting is used for transactions that are currently being
    // executed.
    TxStatusExecuting = "executing",
    // TxStatusReverted is used for transactions that were reverted during
    // execution.
    TxStatusReverted = "reverted",
    // TxStatusDone is used for transactions that have been successfully
    // executed.
    TxStatusDone = "done",
}

export const TxStatusIndex = {
    [TxStatus.TxStatusNil]: 0,
    [TxStatus.TxStatusConfirming]: 1,
    [TxStatus.TxStatusPending]: 2,
    [TxStatus.TxStatusExecuting]: 3,
    [TxStatus.TxStatusReverted]: 4,
    [TxStatus.TxStatusDone]: 5,
};
