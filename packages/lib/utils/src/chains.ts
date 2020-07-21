import { Chain, OriginChain, Tx, UTXO, UTXOIndex, UTXOWithChain } from "@renproject/interfaces";
import { RenNetworkDetails } from "@renproject/networks";
import { ripemd160, sha256 } from "ethereumjs-util";

import { Ox, SECONDS, sleep } from "./common";

/**
 * Hash160, used for bitcoin public keys.
 */
export const hash160 = (publicKey: Buffer): Buffer =>
    ripemd160(
        sha256(publicKey),
        // Don't pad
        false);

/**
 * Generate Gateway address for a cross-chain transfer's origin chain.
 */
export const generateAddress = (chain: OriginChain<any>, gHash: string, mpkh: Buffer, isTestnet: boolean): string => {
    return chain.createAddress(isTestnet, Ox(mpkh), gHash);
};

/**
 * Retrieves unspent deposits at the provided address.
 * An optional `confirmations` parameter limits UTXOs to ones with at least that
 * amount of confirmations.
 */
export const retrieveDeposits = async (_network: RenNetworkDetails, chain: OriginChain<any>, address: string, confirmations = 0): Promise<UTXOWithChain[]> => {
    return (await chain.getDeposits(_network)(address, confirmations)).map((utxo: UTXO) => ({ chain: Chain.Bitcoin as Chain.Bitcoin, utxo }));
};

/**
 * Returns the number of confirmations for the specified UTXO.
 */
export const retrieveConfirmations = async (_network: RenNetworkDetails, chain: OriginChain<any>, transaction: Tx): Promise<number> => {
    // tslint:disable-next-line: no-any
    const txid = transaction.chain === Chain.Ethereum ? 0 : transaction.utxo ? transaction.utxo.txHash : (transaction as any).hash;
    if (!txid) {
        return 0;
    }
    return (await chain.getConfirmations(_network)(txid));
};

export const waitForConfirmations = async (network: RenNetworkDetails, chain: OriginChain<any>, specifiedDeposit: UTXOIndex, confirmations: number, _recipient: string, onDeposit: (deposit: UTXOWithChain) => void): Promise<UTXOIndex> => {

    /**
     * Blocknative currently doesn't support `txSpeedUp` for chains other than Ethereum.
     */

    // let blocknative;
    // try {
    //     // Initialize Blocknative SDK.
    //     blocknative = new BlocknativeSdk({
    //         dappId: "6b3d07f1-b158-4cf1-99ec-919b11fe3654", // Public RenJS key.
    //         system: "bitcoin",
    //         networkId: network.isTestnet ? 2 : 1,
    //     });

    //     const { emitter } = blocknative.transaction(specifiedDeposit.txHash);

    //     emitter.on("txSpeedUp", state => {
    //         // Find outputs with the same recipient.
    //         let newOut = (state as unknown as { outputs: Array<{ address: string, value: string }> }).outputs.map((x, i) => ({ ...x, i })).filter(out => out.address === recipient);
    //         // If there are multiple, see if one of them has the same original vOut.
    //         if (newOut.length && newOut.filter(out => out.i === specifiedDeposit.vOut).length) {
    //             newOut = newOut.filter(out => out.i === specifiedDeposit.vOut);
    //         }
    //         if (state.txid && newOut.length) {
    //             // Update transaction details.
    //             specifiedDeposit = {
    //                 txHash: state.txid,
    //                 vOut: newOut[0].i,
    //             };
    //         }
    //     });
    // } catch (error) {
    //     // Ignore blocknative error.
    // }

    let previousUtxoConfirmations = -1;
    let errorCount = 0;
    const errorCountLimit = 10;
    // tslint:disable-next-line: no-constant-condition
    while (true) {
        try {
            const utxoConfirmations = await retrieveConfirmations(network, chain, {
                chain: chain.name as Chain,
                hash: specifiedDeposit.txHash
            });
            if (utxoConfirmations > previousUtxoConfirmations) {
                previousUtxoConfirmations = utxoConfirmations;
                const utxo = {
                    chain: chain.name,
                    utxo: {
                        txHash: specifiedDeposit.txHash,
                        amount: 0, // TODO: Get value
                        vOut: specifiedDeposit.vOut,
                        confirmations: utxoConfirmations,
                    }
                };
                onDeposit(utxo);
            }
            if (utxoConfirmations >= confirmations) {
                break;
            }
        } catch (error) {
            if (errorCount < errorCountLimit) {
                console.error(error);
                errorCount += 1;
            } else {
                throw error;
            }
        }
        await sleep(15 * SECONDS);
    }

    // try {
    //     // Destroy blocknative SDK.
    //     if (blocknative) {
    //         blocknative.unsubscribe(specifiedDeposit.txHash);
    //         blocknative.destroy();
    //     }
    // } catch (error) {
    //     // Ignore blocknative error.
    // }

    return specifiedDeposit;
};
