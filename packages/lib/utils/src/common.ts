import BigNumber from "bignumber.js";
import { AbiCoder } from "web3-eth-abi";

import { assertType } from "./assert";

/**
 * Represents 1 second for functions that accept a parameter in milliseconds.
 */
export const SECONDS = 1000;

/**
 * Pauses the thread for the specified number of milliseconds.
 * @param ms The number of milliseconds to pause for.
 */
export const sleep = async (ms: number): Promise<void> =>
    // tslint:disable-next-line: no-string-based-set-timeout
    new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * Remove 0x prefix from a hex string. If the input doesn't have a 0x prefix,
 * it's returned unchanged.
 * @param hex The hex value to be prefixed.
 */
export const strip0x = (hex: string) => {
    // Type validation
    assertType<string>("string", { hex });

    return hex.substring(0, 2) === "0x" ? hex.slice(2) : hex;
};

/**
 * Add a 0x prefix to a hex value, converting to a string first. If the input
 * is already prefixed, it's returned unchanged.
 * @param hex The hex value to be prefixed.
 */
export const Ox = (hex: Buffer | string, { prefix } = { prefix: "0x" }) => {
    const hexString = typeof hex === "string" ? hex : hex.toString("hex");
    return hexString.substring(0, 2) === prefix
        ? hexString
        : `${prefix}${hexString}`;
};

export const fromHex = (hex: Buffer | string): Buffer => {
    assertType<Buffer | string>("Buffer | string", { hex });
    return Buffer.isBuffer(hex) ? hex : Buffer.from(strip0x(hex), "hex");
};

export const fromBase64 = (base64: Buffer | string): Buffer => {
    assertType<Buffer | string>("Buffer | string", {
        base64,
    });
    return Buffer.isBuffer(base64)
        ? base64
        : Buffer.from(strip0x(base64), "base64");
};

export const toBase64 = (input: Buffer) => {
    assertType<Buffer>("Buffer", { input });
    return input.toString("base64");
};

export const fromBigNumber = (bn: BigNumber): Buffer => {
    const bnStr = bn.toString(16);
    // Pad if necessary
    return Buffer.from(bnStr.length % 2 ? "0" + bnStr : bnStr, "hex");
};

// Unpadded alternate base64 encoding defined in RFC 4648, commonly used in
// URLs.
export const toURLBase64 = (input: Buffer | string) => {
    assertType<Buffer | string>("Buffer | string", {
        input,
    });

    return (Buffer.isBuffer(input) ? input : fromHex(input))
        .toString("base64")
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/\=+$/, "");
};

// tslint:disable-next-line: no-any
export const extractError = (error: any): string => {
    if (error && typeof error === "object") {
        if (error.response) {
            return extractError(error.response);
        }
        if (error.data) {
            return extractError(error.data);
        }
        if (error.error) {
            return extractError(error.error);
        }
        if (error.context) {
            return extractError(error.context);
        }
        if (error.message) {
            return extractError(error.message);
        }
        if (error.statusText) {
            return extractError(error.statusText);
        }
    }
    try {
        if (typeof error === "string") {
            if (error.slice(0, 7) === "Error: ") {
                error = error.slice(7);
            }
            return error;
        }
        return JSON.stringify(error);
    } catch (error) {
        // Ignore JSON error
    }
    return String(error);
};

export const retryNTimes = async <T>(
    fnCall: () => Promise<T>,
    retries: number,
): Promise<T> => {
    let returnError;
    for (let i = 0; retries === -1 || i < retries; i++) {
        try {
            return await fnCall();
        } catch (error) {
            // Fix error message.
            const errorMessage = extractError(error);
            // If error.message is undefined, set it to the extracted error.
            error.message = error.message || errorMessage;
            if (errorMessage && errorMessage !== error.message) {
                error.message += ` (${errorMessage})`;
            }
            returnError = error;
        }
    }
    throw returnError;
};

/**
 * Generates a random hex string (prefixed with '0x').
 * @param bytes The number of bytes to generate.
 */
export const randomBytes = (bytes: number): Buffer => {
    try {
        // @ts-ignore
        if (window) {
            const uints = new Uint32Array(bytes / 4); // 4 bytes (32 bits)
            // @ts-ignore
            window.crypto.getRandomValues(uints);
            let str = "";
            for (const uint of uints) {
                str +=
                    "0".repeat(8 - uint.toString(16).length) +
                    uint.toString(16);
            }
            return fromHex(str);
        }
    } catch (error) {
        // Ignore error
    }
    // tslint:disable-next-line: no-shadowed-variable
    const crypto = require("crypto");
    return crypto.randomBytes(bytes);
};

/**
 * Returns a random 32 byte Buffer.
 */
export const randomNonce = (): Buffer => randomBytes(32);

export const emptyNonce = () => fromHex("00".repeat(32));

export const rawEncode = (
    types: Array<string | {}>,
    // tslint:disable-next-line:no-any
    parameters: any[],
): Buffer => fromHex(new AbiCoder().encodeParameters(types, parameters));
