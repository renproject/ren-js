import BN from "bn.js";

/**
 * Remove 0x prefix from a hex string. If the input doesn't have a 0x prefix,
 * it's returned unchanged.
 * @param hex The hex value to be prefixed.
 */
export const strip0x = (hex: string) => hex.substring(0, 2) === "0x" ? hex.slice(2) : hex;

/**
 * Add a 0x prefix to a hex value, converting to a string first. If the input
 * is already prefixed, it's returned unchanged.
 * @param hex The hex value to be prefixed.
 */
export const Ox = (hex: string | BN | Buffer) => {
    const hexString = typeof hex === "string" ? hex : hex.toString("hex");
    return hexString.substring(0, 2) === "0x" ? hexString : `0x${hexString}`;
};
