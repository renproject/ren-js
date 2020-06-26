import {
    bchAddressFrom, bchAddressToHex, btcAddressFrom, btcAddressToHex, createBCHAddress,
    createBTCAddress, createZECAddress, getBitcoinCashConfirmations, getBitcoinCashUTXOs,
    getBitcoinConfirmations, getBitcoinUTXOs, getZcashConfirmations, getZcashUTXOs, zecAddressFrom,
    zecAddressToHex,
} from "@renproject/chains";
import { RenNetworkDetails } from "@renproject/contracts";
import {
    Chain, RenContract, Tokens as CommonTokens, Tx, UTXO, UTXOIndex, UTXOWithChain,
} from "@renproject/interfaces";
import { ripemd160, sha256 } from "ethereumjs-util";
import { UTXO as SendCryptoUTXO } from "send-crypto";

import { Ox, SECONDS, sleep } from "./common";
import { parseRenContract } from "./renVMUtils";

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
export const generateAddress = (renContract: RenContract, gHash: string, mpkh: Buffer, isTestnet: boolean): string => {
    const chain = parseRenContract(renContract).from;
    switch (chain) {
        case Chain.Bitcoin:
            return createBTCAddress(isTestnet, Ox(mpkh), gHash);
        case Chain.Zcash:
            return createZECAddress(isTestnet, Ox(mpkh), gHash);
        case Chain.BitcoinCash:
            return createBCHAddress(isTestnet, Ox(mpkh), gHash);
        default:
            throw new Error(`Unable to generate deposit address for chain ${chain}`);
    }
};

/**
 * Retrieves unspent deposits at the provided address.
 * An optional `confirmations` parameter limits UTXOs to ones with at least that
 * amount of confirmations.
 */
export const retrieveDeposits = async (_network: RenNetworkDetails, renContract: RenContract, address: string, confirmations = 0): Promise<UTXOWithChain[]> => {
    const chain = parseRenContract(renContract).from;
    switch (chain) {
        case Chain.Bitcoin:
            return (await getBitcoinUTXOs(_network)(address, confirmations)).map((utxo: UTXO) => ({ chain: Chain.Bitcoin as Chain.Bitcoin, utxo }));
        case Chain.Zcash:
            return (await getZcashUTXOs(_network)(address, confirmations)).map((utxo: UTXO) => ({ chain: Chain.Zcash as Chain.Zcash, utxo }));
        case Chain.BitcoinCash:
            // tslint:disable-next-line: no-unnecessary-type-assertion
            return (await getBitcoinCashUTXOs(_network)(address, confirmations)).map((utxo: UTXO) => ({ chain: Chain.BitcoinCash as Chain.BitcoinCash, utxo }));
        default:
            throw new Error(`Unable to retrieve deposits for chain ${chain}`);
    }
};

/**
 * Returns the number of confirmations for the specified UTXO.
 */
export const retrieveConfirmations = async (_network: RenNetworkDetails, transaction: Tx): Promise<number> => {
    // tslint:disable-next-line: no-any
    const txid = transaction.chain === Chain.Ethereum ? 0 : transaction.utxo ? transaction.utxo.txHash : (transaction as any).hash;
    if (!txid) {
        return 0;
    }
    switch (transaction.chain) {
        case Chain.Bitcoin:
            return (await getBitcoinConfirmations(_network)(txid));
        case Chain.Zcash:
            return (await getZcashConfirmations(_network)(txid));
        case Chain.BitcoinCash:
            // tslint:disable-next-line: no-unnecessary-type-assertion
            return (await getBitcoinCashConfirmations(_network)(txid));
        default:
            throw new Error(`Unable to retrieve deposits for chain ${transaction.chain}`);
    }
};

export interface AssetUtils {
    getUTXOs: ({ isTestnet }: {
        isTestnet: boolean;
    }) => (address: string, confirmations: number) => Promise<readonly SendCryptoUTXO[]>;
    addressToHex: (address: string) => string;
    addressFrom: (address: string) => string;
}

export const btcUtils: AssetUtils = {
    getUTXOs: getBitcoinUTXOs,
    addressToHex: btcAddressToHex,
    addressFrom: btcAddressFrom,
};

export const zecUtils: AssetUtils = {
    getUTXOs: getZcashUTXOs,
    addressToHex: zecAddressToHex,
    addressFrom: zecAddressFrom,
};

export const bchUtils: AssetUtils = {
    getUTXOs: getBitcoinCashUTXOs,
    addressToHex: bchAddressToHex,
    addressFrom: bchAddressFrom,
};

export const Tokens: {
    BTC: AssetUtils & typeof CommonTokens["BTC"],
    ZEC: AssetUtils & typeof CommonTokens["ZEC"],
    BCH: AssetUtils & typeof CommonTokens["BCH"],
} = {
    // Bitcoin
    BTC: {
        ...CommonTokens.BTC,
        ...btcUtils,
    },

    // Zcash
    ZEC: {
        ...CommonTokens.ZEC,
        ...zecUtils,
    },

    // Bitcoin Cash
    BCH: {
        ...CommonTokens.BCH,
        ...bchUtils
    },
};

export const waitForConfirmations = async (network: RenNetworkDetails, sendToken: RenContract, specifiedDeposit: UTXOIndex, confirmations: number, _recipient: string, onDeposit: (deposit: UTXOWithChain) => void): Promise<UTXOIndex> => {

    /**
     * Blocknative currently doesn't support `txSpeedUp` for btc, zec or bch
     * transactions.
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
            const utxoConfirmations = await retrieveConfirmations(network, {
                chain: parseRenContract(sendToken).from,
                hash: specifiedDeposit.txHash
            });
            if (utxoConfirmations > previousUtxoConfirmations) {
                previousUtxoConfirmations = utxoConfirmations;
                const utxo = {
                    chain: parseRenContract(sendToken).from as Chain.Bitcoin | Chain.BitcoinCash | Chain.Zcash,
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
