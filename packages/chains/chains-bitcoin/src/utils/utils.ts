import { assertType, utils } from "@renproject/utils";
import { bech32 } from "bech32";
import base58 from "bs58";
import { ripemd160 as createRipemd160 } from "@noble/hashes/ripemd160";
import { validate } from "wallet-address-validator";
import BTCValidator from "wallet-address-validator/src/bitcoin_validator";

import {
    BitcoinNetworkConfig,
    BitcoinNetworkConfigMap,
    BitcoinNetworkInput,
    isBitcoinNetworkConfig,
} from "./types";

export const addressToBytes = (address: string): Uint8Array => {
    // Attempt to decode address as a bech32 address, and if that fails
    // fall back to base58.
    try {
        const [type, ...words] = bech32.decode(address).words;
        return utils.concat([
            new Uint8Array([type]),
            new Uint8Array(bech32.fromWords(words)),
        ]);
    } catch (error) {
        try {
            return new Uint8Array(base58.decode(address));
        } catch (internalError) {
            throw new Error(`Unrecognized address format "${address}".`);
        }
    }
};

export const validateAddress = (
    address: string,
    asset: string,
    network: string,
): boolean => {
    if (asset === "DGB") {
        const currency = {
            name: "digibyte",
            symbol: "dgb",
            addressTypes: { prod: ["1e", "3f"], testnet: ["7e", "8c"] },
            validator: BTCValidator,
            segwitHrp: network === "prod" ? "dgb" : "dgbt",
        };

        return currency.validator.isValidAddress(address, currency, network);
    }

    return validate(address, asset, network);
};

export const StandardBitcoinExplorer = (
    baseUrl: string,
): BitcoinNetworkConfig["explorer"] => ({
    url: baseUrl,
    address: (address: string) =>
        `${baseUrl.replace(/\/$/, "")}/address/${address}`,
    transaction: (transaction: string) =>
        `${baseUrl.replace(/\/$/, "")}/tx/${transaction || ""}`,
});

export const SoChainExplorer = (
    chainPath: string,
    chainId: string,
): BitcoinNetworkConfig["explorer"] => ({
    url: `https://sochain.com/${chainPath}`,
    address: (address: string) =>
        `https://sochain.com/address/${chainId}/${address}`,
    transaction: (transaction: string) =>
        `https://sochain.com/tx/${chainId}/${transaction}`,
});

export const resolveBitcoinNetworkConfig = (
    configMap: BitcoinNetworkConfigMap,
    renNetwork: BitcoinNetworkInput,
): BitcoinNetworkConfig => {
    let networkConfig: BitcoinNetworkConfig | undefined;
    if (renNetwork && isBitcoinNetworkConfig(renNetwork)) {
        networkConfig = renNetwork;
    } else {
        networkConfig = configMap[renNetwork];
    }

    if (!networkConfig) {
        throw new Error(
            `Unsupported network '${String(
                renNetwork
                    ? typeof renNetwork === "string"
                        ? renNetwork
                        : renNetwork.selector
                    : renNetwork,
            )}'. Valid options are 'mainnet', 'testnet' or a BitcoinNetworkConfig object.`,
        );
    }

    return networkConfig;
};

/** Calculate the ripemd160 hash of the input. */
export const ripemd160 = (...msg: Uint8Array[]): Uint8Array => {
    assertType<Uint8Array[]>("Uint8Array[]", { msg });
    return new Uint8Array(createRipemd160(utils.concat(msg)));
};

/**
 * hash160 is used to calculate the Bitcoin address from a private key, and is
 * equivalent to `ripemd160(sha256(publicKey))`
 */
export const hash160 = (...msg: Uint8Array[]): Uint8Array => {
    assertType<Uint8Array[]>("Uint8Array[]", { msg });
    return ripemd160(utils.sha256(utils.concat(msg)));
};

/**
 * Convert a Bitcoin transaction hash from its standard format to the format
 * required by RenVM.
 * @param txidFormatted A Bitcoin transaction hash formatted as an unprefixed
 * hex string.
 * @returns The same Bitcoin transaction hash formatted as a base64 string.
 */
export function txidFormattedToTxid(txidFormatted: string) {
    return utils.toURLBase64(utils.fromHex(txidFormatted).reverse());
}

/**
 * Convert a Bitcoin transaction hash from the format required by RenVM to its
 * standard format.
 * @param txid A Bitcoin transaction hash formatted as a base64 string.
 * @returns The same Bitcoin transaction hash formatted as an unprefixed hex
 * string.
 */
export function txidToTxidFormatted(txid: string) {
    return utils.toHex(utils.fromBase64(txid).reverse());
}
