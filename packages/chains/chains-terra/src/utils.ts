import { utils } from "@renproject/utils";

/**
 * Convert a Terra transaction hash from its standard format to the format
 * required by RenVM.
 *
 * @param txidFormatted A Terra transaction hash formatted as an unprefixed
 * hex string.
 * @returns The same Terra transaction hash formatted as a base64 string.
 */
export function txidFormattedToTxid(txidFormatted: string): string {
    return utils.toURLBase64(utils.fromHex(txidFormatted));
}

/**
 * Convert a Terra transaction hash from the format required by RenVM to its
 * standard format.
 *
 * @param txid A Terra transaction hash formatted as a base64 string.
 * @returns The same Terra transaction hash formatted as an unprefixed hex
 * string.
 */
export function txidToTxidFormatted(txid: string): string {
    return utils.toHex(utils.fromBase64(txid)).toUpperCase();
}
