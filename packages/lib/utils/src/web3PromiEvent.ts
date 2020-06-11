import Web3 from "web3";
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


/**
 * Bind a promiEvent to an Ethereum transaction hash, sending confirmation
 * events. Web3 may export a similar function, which should be used instead if
 * it exists.
 *
 * @param web3 A Web3 instance for watching for confirmations.
 * @param txHash The Ethereum transaction has as a hex string.
 * @param promiEvent The existing promiEvent to forward events to.
 */
export const manualPromiEvent = async (web3: Web3, txHash: string, promiEvent: PromiEvent<TransactionReceipt, Web3Events & RenWeb3Events>) => {
    const receipt = await web3.eth.getTransactionReceipt(txHash);
    promiEvent.emit("transactionHash", txHash);

    const emitConfirmation = async () => {
        const currentBlock = await web3.eth.getBlockNumber();
        // tslint:disable-next-line: no-any
        promiEvent.emit("confirmation", Math.max(0, currentBlock - receipt.blockNumber), receipt as any);
    };

    // The following section should be revised to properly
    // register the event emitter to the transaction's
    // confirmations, so that on("confirmation") works
    // as expected. This code branch only occurs if a
    // completed transfer is passed to RenJS again, which
    // should not usually happen.

    // Emit confirmation now and in 1s, since a common use
    // case may be to have the following code, which doesn't
    // work if we emit the txHash and confirmations
    // with no time in between:
    //
    // ```js
    // const txHash = await new Promise((resolve, reject) => lockAndMint.on("transactionHash", resolve).catch(reject));
    // lockAndMint.on("confirmation", () => { /* do something */ });
    // ```
    await emitConfirmation();
    setTimeout(emitConfirmation, 1000);
    return receipt;
};
