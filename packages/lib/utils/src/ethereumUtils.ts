import BlocknativeSdk from "bnc-sdk";
import Web3 from "web3";
import { TransactionConfig, TransactionReceipt } from "web3-core";
import { AbiCoder } from "web3-eth-abi";
import { keccak256 as web3Keccak256 } from "web3-utils";

import { Ox, SECONDS, sleep, strip0x } from "./common";

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
export const waitForReceipt = async (
    web3: Web3,
    transactionHash: string,
    blocknative?: BlocknativeSdk,
) =>
    new Promise<TransactionReceipt>(async (resolve, reject) => {
        let blocknativeInitialized = false;

        try {
            if (!blocknative) {
                // Initialize Blocknative SDK.
                blocknative = new BlocknativeSdk({
                    dappId: "6b3d07f1-b158-4cf1-99ec-919b11fe3654", // Public RenJS key.
                    networkId: await web3.eth.net.getId(),
                });
                blocknativeInitialized = true;
            }

            const { emitter } = blocknative.transaction(transactionHash);
            emitter.on("txSpeedUp", (state) => {
                if (state.hash) {
                    transactionHash = Ox(state.hash);
                }
            });
            emitter.on("txCancel", () => {
                reject(new Error("Ethereum transaction was cancelled."));
            });
        } catch (error) {
            // Ignore blocknative error.
        }

        // Wait for confirmation
        let receipt: TransactionReceipt | undefined;
        while (!receipt || !receipt.blockHash) {
            receipt = (await web3.eth.getTransactionReceipt(
                transactionHash,
            )) as TransactionReceipt;
            if (receipt && receipt.blockHash) {
                break;
            }
            await sleep(3 * SECONDS);
        }

        try {
            // Destroy blocknative SDK.
            if (blocknative && blocknativeInitialized) {
                blocknative.destroy();
            }
        } catch (error) {
            // Ignore blocknative error.
        }

        // Status might be undefined - so check against `false` explicitly.
        if (receipt.status === false) {
            reject(
                new Error(
                    `Transaction was reverted. { "transactionHash": "${transactionHash}" }`,
                ),
            );
            return;
        }

        resolve(receipt);
        return;
    });

export const extractBurnReference = async (
    web3: Web3,
    txHash: string,
): Promise<number | string> => {
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
export const withDefaultAccount = async (
    web3: Web3,
    config: TransactionConfig,
): Promise<TransactionConfig> => {
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
export const rawEncode = (
    types: Array<string | {}>,
    parameters: any[],
): Buffer =>
    Buffer.from(
        strip0x(new AbiCoder().encodeParameters(types, parameters)),
        "hex",
    );
