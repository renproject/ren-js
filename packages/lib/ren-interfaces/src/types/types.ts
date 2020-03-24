import { SerializableShiftInParams, SerializableShiftOutParams } from "./parameters";
import { Chain, RenContract } from "./renVM";
import { UnmarshalledBurnTx, UnmarshalledMintTx } from "./unmarshalled";

export interface Tx {
    hash: string;
    chain: Chain;
}

export enum ShiftInStatus {
    Committed = "shiftIn_committed",
    Deposited = "shiftIn_deposited",
    Confirmed = "shiftIn_confirmed",
    SubmittedToRenVM = "shiftIn_submittedToRenVM",
    ReturnedFromRenVM = "shiftIn_returnedFromRenVM",
    SubmittedToEthereum = "shiftIn_submittedToEthereum",
    ConfirmedOnEthereum = "shiftIn_confirmedOnEthereum",
}

export enum ShiftOutStatus {
    Committed = "shiftOut_committed",
    SubmittedToEthereum = "shiftOut_submittedToEthereum",
    ConfirmedOnEthereum = "shiftOut_confirmedOnEthereum",
    SubmittedToRenVM = "shiftOut_submittedToRenVM",
    ReturnedFromRenVM = "shiftOut_returnedFromRenVM",
    NoBurnFound = "shiftOut_noBurnFound",
}

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

export interface ShiftNonce {
    nonce: string;
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

export interface ShiftInEvent extends HistoryEventCommon {
    shiftIn: true;
    status: ShiftInStatus;
    shiftParams: SerializableShiftInParams;
    renVMQuery: UnmarshalledMintTx | null;
}

export interface ShiftOutEvent extends HistoryEventCommon {
    shiftIn: false;
    status: ShiftOutStatus;
    shiftParams: SerializableShiftOutParams;
    renVMQuery: UnmarshalledBurnTx | null;
}

export type HistoryEvent = ShiftInEvent | ShiftOutEvent;
