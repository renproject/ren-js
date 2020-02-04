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

// TODO: Generate uuid properly
// tslint:disable-next-line: insecure-random
const randomID = () => String(Math.random()).slice(2);

export const postMessageToClient = <T>(window: Window, frameID: string, type: GatewayMessageType, payload: T) => {
    const messageID = randomID();
    const message: GatewayMessage<T> = { from: "ren", type, frameID, payload, messageID };
    window.parent.postMessage(message, "*");
};

export const postErrorToClient = (window: Window, frameID: string, type: GatewayMessageType, error: string) => {
    const messageID = randomID();
    const message: GatewayMessage<{}> = { from: "ren", type, frameID, payload: {}, error, messageID };
    window.parent.postMessage(message, "*");
};

// tslint:disable-next-line: no-any
export const acknowledgeMessage = <T>(message: GatewayMessage<T>, payload?: any) => {
    const response: GatewayMessage<{}> = { from: "ren", type: GatewayMessageType.Acknowledgement, frameID: message.frameID, payload: payload || {}, messageID: message.messageID };
    window.parent.postMessage(response, "*");
};
