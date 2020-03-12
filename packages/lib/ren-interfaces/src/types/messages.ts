import { SerializableShiftParams, TransactionConfig } from "./parameters";
import { HistoryEvent, ShiftInEvent, ShiftInStatus, ShiftOutEvent, ShiftOutStatus } from "./types";
import { UnmarshalledTx } from "./unmarshalled";

export enum GatewayMessageType {
    Pause = "pause",
    Resume = "resume",
    Ready = "ready",
    Shift = "shift",

    Trades = "trades",
    GetTrades = "getTrades",

    Status = "status",
    GetStatus = "getStatus",
    Cancel = "cancel",
    Error = "error",
    Done = "done",

    SendTransaction = "sendTransaction",
    GetTransactionStatus = "getTransactionStatus",
    GetTransactionBurn = "getTransactionBurn",

    Acknowledgement = "acknowledgement",
}

export type GatewayMessagePayload<Type extends GatewayMessageType> =
    Type extends GatewayMessageType.Pause ? {} :
    Type extends GatewayMessageType.Resume ? {} :
    Type extends GatewayMessageType.Ready ? {} :
    Type extends GatewayMessageType.Shift ? {
        shift: SerializableShiftParams | ShiftInEvent | ShiftOutEvent,
        paused: boolean,
    } :
    Type extends GatewayMessageType.GetTrades ? ({} | Map<string, HistoryEvent>) :
    Type extends GatewayMessageType.Trades ? Map<string, HistoryEvent> :
    Type extends GatewayMessageType.Status ? {
        status: ShiftInStatus | ShiftOutStatus | undefined;
        details: null;
    } :
    Type extends GatewayMessageType.GetStatus ? {} :
    Type extends GatewayMessageType.Cancel ? {} :
    Type extends GatewayMessageType.Error ? {
        message: string;
    } :
    Type extends GatewayMessageType.Done ? {} | UnmarshalledTx :

    Type extends GatewayMessageType.SendTransaction ? { transactionConfig: TransactionConfig } :
    Type extends GatewayMessageType.GetTransactionStatus ? { txHash: string } :
    Type extends GatewayMessageType.GetTransactionBurn ? { txHash: string } :

    // tslint:disable-next-line: no-any
    Type extends GatewayMessageType.Acknowledgement ? any : never;

export type GatewayMessageResponse<Type extends GatewayMessageType> =
    // tslint:disable-next-line: no-any
    Type extends GatewayMessageType.GetStatus ? { status: ShiftInStatus | ShiftOutStatus, details: any | null } :

    Type extends GatewayMessageType.SendTransaction ? { txHash?: string, error?: string } :
    Type extends GatewayMessageType.GetTransactionStatus ? { confirmations?: number, error?: string } :
    Type extends GatewayMessageType.GetTransactionBurn ? { burnReference?: string | number, error?: string } :
    never;

export interface GatewayMessage<Type extends GatewayMessageType> {
    from: "ren";
    frameID: string;
    messageID: string;
    type: Type;
    payload: GatewayMessagePayload<Type>;
    error?: string;
}
