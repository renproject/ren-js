import { GatewayParams } from "./parameters/parameters";
import { HistoryEvent, ShiftInStatus, ShiftOutStatus } from "./types";
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
    Acknowledgement = "acknowledgement",
}

export type GatewayMessagePayload<Type extends GatewayMessageType> =
    Type extends GatewayMessageType.Pause ? {} :
    Type extends GatewayMessageType.Resume ? {} :
    Type extends GatewayMessageType.Ready ? {} :
    Type extends GatewayMessageType.Shift ? {
        shift: GatewayParams,
        paused: boolean,
    } :
    Type extends GatewayMessageType.GetTrades ? ({} | Map<string, HistoryEvent>) :
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
    // tslint:disable-next-line: no-any
    Type extends GatewayMessageType.Acknowledgement ? any : never;

export interface GatewayMessage<Payload> {
    from: "ren";
    frameID: string;
    messageID: string;
    type: GatewayMessageType;
    payload: Payload;
    error?: string;
}
