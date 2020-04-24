import {
    bchAddressFrom, bchAddressToHex, btcAddressFrom, btcAddressToHex, createBCHAddress,
    createBTCAddress, createZECAddress, getBitcoinCashConfirmations, getBitcoinCashUTXOs,
    getBitcoinConfirmations, getBitcoinUTXOs, getZcashConfirmations, getZcashUTXOs, zecAddressFrom,
    zecAddressToHex,
} from "@renproject/chains";
import {
    Chain, NetworkDetails, RenContract, Tokens as CommonTokens, Tx, UTXO, UTXOWithChain,
} from "@renproject/interfaces";
import { ripemd160, sha256 } from "ethereumjs-util";

import { Ox } from "./common";
import { parseRenContract } from "./renVMUtils";

// const hexOrBase64ToBuffer = (value: string | Buffer): Buffer =>
//     typeof value === "string" ?
//         value.slice(0, 2) === "0x" ?
//             Buffer.from(strip0x(value), "hex") :
//             Buffer.from(value, "base64") :
//         Buffer.from(value);

export const hash160 = (publicKey: Buffer): Buffer =>
    ripemd160(
        sha256(
            publicKey),
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
export const retrieveDeposits = async (_network: NetworkDetails, renContract: RenContract, depositAddress: string, confirmations = 0): Promise<UTXOWithChain[]> => {
    const chain = parseRenContract(renContract).from;
    switch (chain) {
        case Chain.Bitcoin:
            return (await getBitcoinUTXOs(_network)(depositAddress, confirmations)).map((utxo: UTXO) => ({ chain: Chain.Bitcoin as Chain.Bitcoin, utxo }));
        case Chain.Zcash:
            return (await getZcashUTXOs(_network)(depositAddress, confirmations)).map((utxo: UTXO) => ({ chain: Chain.Zcash as Chain.Zcash, utxo }));
        case Chain.BitcoinCash:
            // tslint:disable-next-line: no-unnecessary-type-assertion
            return (await getBitcoinCashUTXOs(_network)(depositAddress, confirmations)).map((utxo: UTXO) => ({ chain: Chain.BitcoinCash as Chain.BitcoinCash, utxo }));
        default:
            throw new Error(`Unable to retrieve deposits for chain ${chain}`);
    }
};

/**
 * Returns the number of confirmations for the specified UTXO.
 */
export const retrieveConfirmations = async (_network: NetworkDetails, transaction: Tx): Promise<number> => {
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

export const btcUtils = {
    getUTXOs: getBitcoinUTXOs,
    addressToHex: btcAddressToHex,
    addressFrom: btcAddressFrom,
};

export const zecUtils = {
    getUTXOs: getZcashUTXOs,
    addressToHex: zecAddressToHex,
    addressFrom: zecAddressFrom,
};

export const bchUtils = {
    getUTXOs: getBitcoinCashUTXOs,
    addressToHex: bchAddressToHex,
    addressFrom: bchAddressFrom,
};

export const Tokens = {
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
