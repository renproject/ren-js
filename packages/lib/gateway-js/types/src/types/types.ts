import { ShiftInParams, ShiftOutParams } from "./parameters";
import { Chain, RenContract } from "./renVM";

export enum GatewayMessageType {
    Pause = "pause",
    Resume = "resume",
    Ready = "ready",
    Shift = "shift",
    GetTrades = "getTrades",
    Status = "status",
    GetStatus = "getStatus",
    Cancel = "cancel",
    Done = "done",
    Acknowledgement = "acknowledgement",
}

export interface GatewayMessage<Payload> {
    from: "ren";
    frameID: string;
    messageID: string;
    type: GatewayMessageType;
    payload: Payload;
    error?: string;
}

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
    RefundedOnEthereum = "shiftIn_refundedOnEthereum",
}

export enum ShiftOutStatus {
    Committed = "shiftOut_committed",
    SubmittedToEthereum = "shiftOut_submittedToEthereum",
    ConfirmedOnEthereum = "shiftOut_confirmedOnEthereum",
    SubmittedToRenVM = "shiftOut_submittedToRenVM",
    ReturnedFromRenVM = "shiftOut_returnedFromRenVM",
    RefundedOnEthereum = "shiftOut_refundedOnEthereum",
}

export declare enum TxStatus {
    TxStatusNil = "nil",
    TxStatusConfirming = "confirming",
    TxStatusPending = "pending",
    TxStatusExecuting = "executing",
    TxStatusDone = "done",
    TxStatusReverted = "reverted"
}

export interface SendTokenInterface {
    sendToken: RenContract;
}

interface HistoryEventCommon {
    id: string;
    time: number; // Seconds since Unix epoch
    inTx: Tx | null;
    outTx: Tx | null;
    messageID: string | null;
    nonce: string;
    renVMStatus: TxStatus | null;
}

export interface ShiftInEvent extends HistoryEventCommon {
    shiftIn: true;
    status: ShiftInStatus;
    shiftParams: ShiftInParams & SendTokenInterface;
}

export interface ShiftOutEvent extends HistoryEventCommon {
    shiftIn: false;
    status: ShiftOutStatus;
    shiftParams: ShiftOutParams & SendTokenInterface;
}

export type HistoryEvent = ShiftInEvent | ShiftOutEvent;
