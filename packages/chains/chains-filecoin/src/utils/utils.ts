import { CID } from "multiformats";

/**
 * Convert a Filecoin transaction hash from its standard format to the format
 * required by RenVM.
 *
 * @param txHash A Filecoin transaction hash formatted as a CID string.
 * @returns The same Filecoin transaction hash as bytes.
 */
export const txHashToBytes = (txHash: string): Uint8Array => {
    return new Uint8Array(CID.parse(txHash).bytes);
};

/**
 * Convert a Filecoin transaction hash from the format required by RenVM to its
 * standard format.
 *
 * @param bytes A Filecoin transaction hash as bytes.
 * @returns The same Filecoin transaction hash formatted as a CID string.
 */
export const txHashFromBytes = (bytes: Uint8Array): string => {
    return CID.decode(bytes).toString();
};
