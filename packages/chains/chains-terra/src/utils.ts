import { utils } from "@renproject/utils";

/**
 * Convert a Terra transaction hash from its standard format to the format
 * required by RenVM.
 *
 * @param txHash A Terra transaction hash formatted as an unprefixed
 * hex string.
 * @returns The same Terra transaction hash formatted as a base64 string.
 */
export const txHashToBytes = (txHash: string): Uint8Array => {
    return utils.fromHex(txHash);
};

/**
 * Convert a Terra transaction hash from the format required by RenVM to its
 * standard format.
 *
 * @param bytes A Terra transaction hash formatted as a base64 string.
 * @returns The same Terra transaction hash formatted as an unprefixed hex
 * string.
 */
export const txHashFromBytes = (bytes: Uint8Array): string => {
    return utils.toHex(bytes).toUpperCase();
};
