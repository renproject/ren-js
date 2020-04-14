import { SerializableBurnAndReleaseParams, SerializableLockAndMintParams } from "./parameters";
import { Chain, RenContract } from "./renVM";
import { UnmarshalledBurnTx, UnmarshalledMintTx } from "./unmarshalled";
import { UTXODetails } from "./utxo";

export type Tx = {
    chain: Chain.Bitcoin | Chain.Zcash | Chain.BitcoinCash;
    address?: string;
    hash?: string;
    utxo?: UTXODetails;
} | {
    chain: Chain.Ethereum;
    hash: string;
};

export enum LockAndMintStatus {
    Committed = "shiftIn_committed",
    Deposited = "shiftIn_deposited",
    Confirmed = "shiftIn_confirmed",
    SubmittedToRenVM = "shiftIn_submittedToRenVM",
    ReturnedFromRenVM = "shiftIn_returnedFromRenVM",
    SubmittedToEthereum = "shiftIn_submittedToEthereum",
    ConfirmedOnEthereum = "shiftIn_confirmedOnEthereum",
}
// Backwards compatibility
export const ShiftInStatus = LockAndMintStatus;
export type ShiftInStatus = LockAndMintStatus;

export enum BurnAndReleaseStatus {
    Committed = "shiftOut_committed",
    SubmittedToEthereum = "shiftOut_submittedToEthereum",
    ConfirmedOnEthereum = "shiftOut_confirmedOnEthereum",
    SubmittedToRenVM = "shiftOut_submittedToRenVM",
    ReturnedFromRenVM = "shiftOut_returnedFromRenVM",
    NoBurnFound = "shiftOut_noBurnFound",
}
// Backwards compatibility
export const ShiftOutStatus = BurnAndReleaseStatus;
export type ShiftOutStatus = BurnAndReleaseStatus;

export enum TxStatus {
    // TxStatusNil is used for transactions that have not been seen, or are
    // otherwise unknown.
    TxStatusNil = "nil",
    // TxStatusConfirming is used for transactions that are currently waiting
    // for their underlying blockchain transactions to ne confirmed.
    TxStatusConfirming = "confirming",
    // TxStatusPending is used for transactions that are waiting for consensus
    // to be reached on when the transaction should be executed.
    TxStatusPending = "pending",
    // TxStatusExecuting is used for transactions that are currently being
    // executed.
    TxStatusExecuting = "executing",
    // TxStatusDone is used for transactions that have been successfully
    // executed.
    TxStatusDone = "done",
    // TxStatusReverted is used for transactions that were reverted during
    // execution.
    TxStatusReverted = "reverted",
}

export interface SendTokenInterface {
    sendToken: RenContract;
}

interface HistoryEventCommon {
    id: string;
    time: number; // Seconds since Unix epoch
    inTx: Tx | null;
    outTx: Tx | null;
    renTxHash: string | null;
    renVMStatus: TxStatus | null;
    returned: boolean;
}

export interface LockAndMintEvent extends HistoryEventCommon {
    shiftIn: true;
    status: LockAndMintStatus;
    shiftParams: SerializableLockAndMintParams;
    renVMQuery: UnmarshalledMintTx | null;
}
export type ShiftInEvent = LockAndMintEvent;

export interface BurnAndReleaseEvent extends HistoryEventCommon {
    shiftIn: false;
    status: BurnAndReleaseStatus;
    shiftParams: SerializableBurnAndReleaseParams;
    renVMQuery: UnmarshalledBurnTx | null;
}
export type ShiftOutEvent = BurnAndReleaseEvent;

export type HistoryEvent = LockAndMintEvent | BurnAndReleaseEvent;
