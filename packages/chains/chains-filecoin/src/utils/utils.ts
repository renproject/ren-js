import { CID } from "multiformats";

import { utils } from "@renproject/utils";

/**
 * Convert a Filecoin transaction hash from its standard format to the format
 * required by RenVM.
 *
 * @param txidFormatted A Filecoin transaction hash formatted as a CID string.
 * @returns The same Filecoin transaction hash formatted as a base64 string.
 */
export function txidFormattedToTxid(txidFormatted: string): string {
    return utils.toURLBase64(new Uint8Array(CID.parse(txidFormatted).bytes));
}

/**
 * Convert a Filecoin transaction hash from the format required by RenVM to its
 * standard format.
 *
 * @param txid A Filecoin transaction hash formatted as a base64 string.
 * @returns The same Filecoin transaction hash formatted as a CID string.
 */
export function txidToTxidFormatted(txid: string): string {
    return CID.decode(utils.fromBase64(txid)).toString();
}
