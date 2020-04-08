import { TransactionReceipt } from "web3-core";

import { PromiEvent } from "./promiEvent";

export type Web3Events = {
    transactionHash: [string];
    receipt: [TransactionReceipt],
    confirmation: [number, TransactionReceipt],
    error: [Error],
};

export type RenWeb3Events = {
    eth_transactionHash: [string];
    eth_receipt: [TransactionReceipt],
    eth_confirmation: [number, TransactionReceipt],
    error: [Error],
};

export const forwardEvents = <T, TEvents extends Web3Events, Y, YEvents extends Web3Events & RenWeb3Events>(src: PromiEvent<T, TEvents>, dest: PromiEvent<Y, YEvents>/*, filterFn = (_name: string) => true*/) => {
    // const forwardEmitterNewListener = (eventName: string, listener: (...args: any[]) => void) => {
    //     if (filterFn(eventName) && listener.name.indexOf("__forward_emitter_") !== 0) {
    //         console.info(`Forwarding ${eventName} Listener:`);
    //         console.info(listener);
    //         src.on(eventName, listener);
    //         src.on("transactionHash", (txHash) => { console.info(`Got transaction hash on src`); });
    //     } else {
    //         console.info("Can't forward PromiEvent event!");
    //     }
    // };

    // const forwardEmitterRemoveListener = (eventName: string, listener: (...args: any[]) => void) => {
    //     src.removeListener(eventName, listener);
    // };

    // // Listeners bound to the destination emitter should be bound to the source emitter.
    // dest.on("newListener", forwardEmitterNewListener);

    // // When a listener is removed from the destination emitter, remove it from the source emitter
    // // (otherwise it will continue to be called).
    // dest.on("removeListener", forwardEmitterRemoveListener);

    // Until the above is fixed, we manually forward each event name:
    src.on("transactionHash", (eventReceipt: string) => { dest.emit("transactionHash", eventReceipt); dest.emit("eth_transactionHash", eventReceipt); });
    src.on("receipt", (eventReceipt: TransactionReceipt) => { dest.emit("receipt", eventReceipt); dest.emit("eth_receipt", eventReceipt); });
    src.on("confirmation", (confNumber: number, eventReceipt: TransactionReceipt) => { dest.emit("confirmation", confNumber, eventReceipt); dest.emit("eth_confirmation", confNumber, eventReceipt); });
    src.on("error", (error: Error) => { dest.emit("error", error); });
};
