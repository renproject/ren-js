import { SerializableTransferParams, TransactionConfig } from "./parameters";
import { RenContract } from "./renVM";
import {
    BurnAndReleaseEvent, BurnAndReleaseStatus, HistoryEvent, LockAndMintEvent, LockAndMintStatus,
} from "./types";
import { UnmarshalledTx } from "./unmarshalled";

/**
 * The names of the messages sent between the Gateway iFrame and GatewayJS
 * library.
 */
export enum GatewayMessageType {
    ToggleSettings = "toggleSettings",
    Pause = "pause",
    Resume = "resume",
    Ready = "ready",
    TransferDetails = "transferDetails",

    Transfers = "Transfers",
    GetTransfers = "GetTransfers",

    Status = "status",
    GetStatus = "getStatus",
    TransferUpdated = "transferUpdated",

    Cancel = "cancel",
    Error = "error",
    Done = "done",

    SendEthereumTx = "sendEthereumTx",
    GetEthereumTxStatus = "getEthereumTxStatus",
    SendEthereumTxConfirmations = "sendEthereumTxConfirmations",
    GetEthereumTxBurn = "getEthereumTxBurn",
    FindMintTransaction = "findMintTransaction",

    RequestNotificationPermission = "requestNotificationPermission",
    ShowNotification = "showNotification",

    Acknowledgement = "acknowledgement",
}

/**
 * The payload type for the messages sent between the Gateway iFrame and
 * GatewayJS library.
 */
export type GatewayMessagePayload<Type extends GatewayMessageType> =
    Type extends GatewayMessageType.ToggleSettings ? {} :
    Type extends GatewayMessageType.Pause ? {} :
    Type extends GatewayMessageType.Resume ? {} :
    Type extends GatewayMessageType.Ready ? {} :
    Type extends GatewayMessageType.TransferDetails ? {
        transferDetails: SerializableTransferParams | LockAndMintEvent | BurnAndReleaseEvent,
        paused: boolean,
        cancelled: boolean,
    } :
    Type extends GatewayMessageType.GetTransfers ? {} :
    Type extends GatewayMessageType.Transfers ? Map<string, HistoryEvent> :
    Type extends GatewayMessageType.Status ? {
        status: LockAndMintStatus | BurnAndReleaseStatus | undefined;
        details: null;
    } :
    Type extends GatewayMessageType.GetStatus ? {} :
    Type extends GatewayMessageType.TransferUpdated ? { transfer: HistoryEvent } :
    Type extends GatewayMessageType.Cancel ? {} :
    Type extends GatewayMessageType.Error ? {
        message: string;
    } :
    Type extends GatewayMessageType.Done ? {} | UnmarshalledTx :

    Type extends GatewayMessageType.SendEthereumTx ? { transactionConfig: TransactionConfig } :
    Type extends GatewayMessageType.GetEthereumTxStatus ? { txHash: string } :
    Type extends GatewayMessageType.SendEthereumTxConfirmations ? { txHash: string, confirmations: number } :
    Type extends GatewayMessageType.GetEthereumTxBurn ? { txHash: string } :
    Type extends GatewayMessageType.FindMintTransaction ? { sigHash: string, token: RenContract } :

    Type extends GatewayMessageType.RequestNotificationPermission ? {} :
    Type extends GatewayMessageType.ShowNotification ? { title: string, body: string } :

    // tslint:disable-next-line: no-any
    Type extends GatewayMessageType.Acknowledgement ? any : never;

/**
 * The response payload type for the replies sent between the Gateway iFrame and
 * GatewayJS library.
 */
export type GatewayMessageResponse<Type extends GatewayMessageType> =
    // tslint:disable-next-line: no-any
    Type extends GatewayMessageType.GetStatus ? { status: LockAndMintStatus | BurnAndReleaseStatus, details: any | null } :

    Type extends GatewayMessageType.SendEthereumTx ? { txHash?: string, error?: string } :
    Type extends GatewayMessageType.GetEthereumTxStatus ? { confirmations?: number, reverted: boolean; error?: string } :
    Type extends GatewayMessageType.GetEthereumTxBurn ? { burnReference?: string | number, error?: string } :
    Type extends GatewayMessageType.FindMintTransaction ? { txHash?: string | undefined, error?: string } :
    Type extends GatewayMessageType.RequestNotificationPermission ? { error?: string } :
    never;

export interface GatewayMessage<Type extends GatewayMessageType> {
    from: "ren";
    frameID: string;
    messageID: string;
    type: Type;
    payload: GatewayMessagePayload<Type>;
    error?: string;
}
