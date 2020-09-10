import { LockChain } from "@renproject/interfaces";
import { ripemd160, sha256 } from "ethereumjs-util";

import { SECONDS, sleep } from "./common";

/**
 * Hash160, used for bitcoin public keys.
 */
export const hash160 = (publicKey: Buffer): Buffer =>
    ripemd160(
        sha256(publicKey),
        // Don't pad
        false
    );

// /**
//  * Generate Gateway address for a cross-chain transfer's origin chain.
//  */
// export const createGatewayAddress = async (asset: string, chain: LockChain, gHash: string, mpkh: Buffer, isTestnet: boolean): Promise<string> => {
//     return chain.createGatewayAddress(asset, mpkh, gHash);
// };

// /**
//  * Retrieves unspent deposits at the provided address.
//  * An optional `confirmations` parameter limits UTXOs to ones with at least that
//  * amount of confirmations.
//  */
// export const retrieveDeposits = async (asset: string, chain: LockChain, address: string): Promise<Array<{}>> => {
//     return (await chain.getDeposits(asset, address));
// };

// /**
//  * Returns the number of confirmations for the specified UTXO.
//  */
// export const retrieveConfirmations = async <T>(asset: string, chain: LockChain<T>, transaction: T): Promise<number> => {
//     return (await chain.isFinalized(asset, transaction);
// };

export const waitForConfirmations = async (
    chain: LockChain,
    specifiedDeposit: {},
    _recipient: string,
    onDeposit: (deposit: {}) => void
): Promise<{}> => {
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
            const { current, target } = await chain.transactionConfidence(
                specifiedDeposit
            );
            if (current > previousUtxoConfirmations) {
                previousUtxoConfirmations = current;
                onDeposit(specifiedDeposit);
            }
            if (current >= target) {
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
