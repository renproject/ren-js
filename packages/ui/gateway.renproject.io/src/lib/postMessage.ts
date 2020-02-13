import {
    GatewayMessage, GatewayMessagePayload, GatewayMessageType,
} from "@renproject/ren-js-common";

// TODO: Generate uuid properly
// tslint:disable-next-line: insecure-random
const randomID = () => String(Math.random()).slice(2);

export const postMessageToClient = <Type extends GatewayMessageType>(window: Window, frameID: string, type: Type, payload: GatewayMessagePayload<Type>) => {
    const messageID = randomID();
    const message: GatewayMessage<Type> = { from: "ren", type, frameID, payload, messageID };
    window.parent.postMessage(message, "*");
};

// tslint:disable-next-line: no-any
export const acknowledgeMessage = <Type extends GatewayMessageType>(message: GatewayMessage<Type>, payload?: any) => {
    const response: GatewayMessage<GatewayMessageType.Acknowledgement> = { from: "ren", type: GatewayMessageType.Acknowledgement, frameID: message.frameID, payload: payload || {}, messageID: message.messageID };
    window.parent.postMessage(response, "*");
};
