import Web3 from "web3";
import { TransactionConfig, TransactionReceipt } from "web3-core";
import { AbiCoder } from "web3-eth-abi";
import { keccak256 as web3Keccak256 } from "web3-utils";

import { sleep, strip0x } from "./common";

export const BURN_TOPIC = web3Keccak256("LogBurn(bytes,uint256,uint256,bytes)");

/**
 * Waits for the receipt of a transaction to be available, retrying every 3
 * seconds until it is.
 *
 * @param web3 A web3 instance.
 * @param transactionHash The hash of the transaction being read.
 *
 * @/param nonce The nonce of the transaction, to detect if it has been
 *        overwritten.
 */
export const waitForReceipt = async (web3: Web3, transactionHash: string/*, nonce?: number*/): Promise<TransactionReceipt> => {

    // TODO: Handle transactions being overwritten.

    // Wait for confirmation
    let receipt: TransactionReceipt | undefined;
    while (!receipt || !receipt.blockHash) {
        receipt = (await web3.eth.getTransactionReceipt(transactionHash)) as TransactionReceipt;
        if (receipt && receipt.blockHash) {
            break;
        }
        await sleep(3 * 1000);
    }

    // Status might be undefined - so check against `false` explicitly.
    if (receipt.status === false) {
        throw new Error(`Transaction was reverted. { "transactionHash": "${transactionHash}" }`);
    }

    return receipt;
};

export const extractBurnReference = async (web3: Web3, txHash: string): Promise<number | string> => {

    const receipt = await waitForReceipt(web3, txHash);

    if (!receipt.logs) {
        throw Error("No events found in transaction");
    }

    let burnReference: number | string | undefined;

    for (const [, event] of Object.entries(receipt.logs)) {
        if (event.topics[0] === BURN_TOPIC) {
            burnReference = event.topics[1] as string;
            break;
        }
    }

    if (!burnReference && burnReference !== 0) {
        throw Error("No reference ID found in logs");
    }

    return burnReference;
};

export const defaultAccountError = "No accounts found in Web3 wallet.";
export const withDefaultAccount = async (web3: Web3, config: TransactionConfig): Promise<TransactionConfig> => {
    if (!config.from) {
        if (web3.eth.defaultAccount) {
            config.from = web3.eth.defaultAccount;
        } else {
            const accounts = await web3.eth.getAccounts();
            if (accounts.length === 0) {
                throw new Error(defaultAccountError);
            }
            config.from = accounts[0];
        }
    }
    return config;
};

// tslint:disable-next-line:no-any
export const rawEncode = (types: Array<string | {}>, parameters: any[]): Buffer =>
    Buffer.from(strip0x((new AbiCoder()).encodeParameters(types, parameters)), "hex");
