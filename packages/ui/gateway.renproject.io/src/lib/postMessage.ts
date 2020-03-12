import {
    GatewayMessage, GatewayMessagePayload, GatewayMessageResponse, GatewayMessageType, sleep,
} from "@renproject/interfaces";

// TODO: Generate uuid properly
// tslint:disable-next-line: insecure-random
const randomID = () => String(Math.random()).slice(2);

// tslint:disable-next-line: no-any
export const addMessageListener = (listener: (e: { readonly data: GatewayMessage<any> }) => void) => {
    window.addEventListener("message", listener);
};

// tslint:disable-next-line: no-any
export const removeMessageListener = (listener: (e: { readonly data: GatewayMessage<any> }) => void) => {
    window.removeEventListener("message", listener);
};

// TODO: Use same code as `gateway`
export const postMessageToClient = async <Type extends GatewayMessageType>(window: Window, frameID: string, type: Type, payload: GatewayMessagePayload<Type>) => new Promise<GatewayMessageResponse<Type>>(async (resolve) => {
    const messageID = randomID();
    const message: GatewayMessage<Type> = { from: "ren", type, frameID, payload, messageID };

    // tslint:disable-next-line: no-any
    let listener: (e: { readonly data: GatewayMessage<any> }) => void;

    let acknowledged = false;
    const removeListener = () => {
        acknowledged = true;
        removeMessageListener(listener);
    };

    // tslint:disable-next-line: no-any
    listener = (e: { readonly data: GatewayMessage<any> }) => {
        if (e.data && e.data.from === "ren" && e.data.type === GatewayMessageType.Acknowledgement && e.data.messageID === messageID) {
            removeListener();
            resolve(e.data.payload);
        }
    };

    addMessageListener(listener);

    let count = 0;

    // Repeat message until acknowledged
    // tslint:disable-next-line: no-any
    while (!acknowledged) {
        if (
            count === 0 || (
                type !== GatewayMessageType.SendTransaction &&
                type !== GatewayMessageType.GetTransactionBurn &&
                type !== GatewayMessageType.GetTransactionStatus
            )
        ) {
            count++;
            window.parent.postMessage(message, "*");
        }
        // Sleep for 1 second
        await sleep(1 * 1000);
    }
});

// tslint:disable-next-line: no-any
export const acknowledgeMessage = <Type extends GatewayMessageType>(message: GatewayMessage<Type>, payload?: GatewayMessageResponse<Type>) => {
    if (message.type === GatewayMessageType.Acknowledgement) {
        return;
    }
    const response: GatewayMessage<GatewayMessageType.Acknowledgement> = { from: "ren", type: GatewayMessageType.Acknowledgement, frameID: message.frameID, payload: payload || {}, messageID: message.messageID };
    window.parent.postMessage(response, "*");
};
