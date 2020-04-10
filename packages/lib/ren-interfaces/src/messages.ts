import { SerializableTransferParams, TransactionConfig } from "./parameters";
import {
    BurnAndReleaseEvent, BurnAndReleaseStatus, HistoryEvent, LockAndMintEvent, LockAndMintStatus,
} from "./types";
import { UnmarshalledTx } from "./unmarshalled";

export enum GatewayMessageType {
    Pause = "pause",
    Resume = "resume",
    Ready = "ready",
    TransferDetails = "transferDetails",

    Transfers = "Transfers",
    GetTransfers = "GetTransfers",

    Status = "status",
    GetStatus = "getStatus",
    Cancel = "cancel",
    Error = "error",
    Done = "done",

    SendEthereumTx = "sendEthereumTx",
    GetEthereumTxStatus = "getEthereumTxStatus",
    GetEthereumTxBurn = "getEthereumTxBurn",

    Acknowledgement = "acknowledgement",
}

export type GatewayMessagePayload<Type extends GatewayMessageType> =
    Type extends GatewayMessageType.Pause ? {} :
    Type extends GatewayMessageType.Resume ? {} :
    Type extends GatewayMessageType.Ready ? {} :
    Type extends GatewayMessageType.TransferDetails ? {
        transferDetails: SerializableTransferParams | LockAndMintEvent | BurnAndReleaseEvent,
        paused: boolean,
    } :
    Type extends GatewayMessageType.GetTransfers ? {} :
    Type extends GatewayMessageType.Transfers ? Map<string, HistoryEvent> :
    Type extends GatewayMessageType.Status ? {
        status: LockAndMintStatus | BurnAndReleaseStatus | undefined;
        details: null;
    } :
    Type extends GatewayMessageType.GetStatus ? {} :
    Type extends GatewayMessageType.Cancel ? {} :
    Type extends GatewayMessageType.Error ? {
        message: string;
    } :
    Type extends GatewayMessageType.Done ? {} | UnmarshalledTx :

    Type extends GatewayMessageType.SendEthereumTx ? { transactionConfig: TransactionConfig } :
    Type extends GatewayMessageType.GetEthereumTxStatus ? { txHash: string } :
    Type extends GatewayMessageType.GetEthereumTxBurn ? { txHash: string } :

    // tslint:disable-next-line: no-any
    Type extends GatewayMessageType.Acknowledgement ? any : never;

export type GatewayMessageResponse<Type extends GatewayMessageType> =
    // tslint:disable-next-line: no-any
    Type extends GatewayMessageType.GetStatus ? { status: LockAndMintStatus | BurnAndReleaseStatus, details: any | null } :

    Type extends GatewayMessageType.SendEthereumTx ? { txHash?: string, error?: string } :
    Type extends GatewayMessageType.GetEthereumTxStatus ? { confirmations?: number, error?: string } :
    Type extends GatewayMessageType.GetEthereumTxBurn ? { burnReference?: string | number, error?: string } :
    never;

export interface GatewayMessage<Type extends GatewayMessageType> {
    from: "ren";
    frameID: string;
    messageID: string;
    type: Type;
    payload: GatewayMessagePayload<Type>;
    error?: string;
}
