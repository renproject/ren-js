import BN from "bn.js";

export const SECONDS = 1000;
export const sleep = async (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export const randomBytes = (bytes: number) => {
    const uints = new Uint32Array(bytes / 4); // 4 bytes (32 bits)
    window.crypto.getRandomValues(uints);
    let str = "";
    for (const uint of uints) {
        str += "0".repeat(8 - uint.toString(16).length) + uint.toString(16);
    }
    return "0x" + str;
};

export const randomNonce = () => randomBytes(32);

export const NULL = (bytes: number) => "0x" + "00".repeat(bytes);

// Remove 0x prefix from a hex string
export const strip0x = (hex: string) => hex.substring(0, 2) === "0x" ? hex.slice(2) : hex;

// Add a 0x prefix to a hex value, converting to a string first
export const Ox = (hex: string | BN | Buffer) => {
    const hexString = typeof hex === "string" ? hex : hex.toString("hex");
    return hexString.substring(0, 2) === "0x" ? hexString : `0x${hexString}`;
};
