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

/**
 * Forward the events emitted by a Web3 PromiEvent to another PromiEvent.
 */
export const forwardWeb3Events = <T, TEvents extends Web3Events, Y, YEvents extends Web3Events & RenWeb3Events>(src: PromiEvent<T, TEvents>, dest: PromiEvent<Y, YEvents>/*, filterFn = (_name: string) => true*/) => {
    src.on("transactionHash", (eventReceipt: string) => { dest.emit("transactionHash", eventReceipt); dest.emit("eth_transactionHash", eventReceipt); });
    src.on("receipt", (eventReceipt: TransactionReceipt) => { dest.emit("receipt", eventReceipt); dest.emit("eth_receipt", eventReceipt); });
    src.on("confirmation", (confNumber: number, eventReceipt: TransactionReceipt) => { dest.emit("confirmation", confNumber, eventReceipt); dest.emit("eth_confirmation", confNumber, eventReceipt); });
    src.on("error", (error: Error) => { dest.emit("error", error); });
};
