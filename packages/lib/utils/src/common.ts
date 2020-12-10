import { Logger } from "@renproject/interfaces";
import BigNumber from "bignumber.js";
import { AbiCoder } from "web3-eth-abi";

import { assertType } from "./assert";

/**
 * Represents 1 second for functions that accept a parameter in milliseconds.
 */
export const SECONDS = 1000;

/**
 * Pauses the thread for the specified number of milliseconds.
 *
 * @param ms The number of milliseconds to pause for.
 */
export const sleep = async (ms: number): Promise<void> =>
    new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * Remove 0x prefix from a hex string. If the input doesn't have a 0x prefix,
 * it's returned unchanged.
 *
 * @param hex The hex value to be prefixed.
 */
export const strip0x = (hex: string): string => {
    // Type validation
    assertType<string>("string", { hex });

    return hex.substring(0, 2) === "0x" ? hex.slice(2) : hex;
};

/**
 * Add a 0x prefix to a hex value, converting to a string first. If the input
 * is already prefixed, it's returned unchanged.
 *
 * @param hex The hex value to be prefixed.
 */
export const Ox = (
    hex: Buffer | string,
    { prefix } = { prefix: "0x" },
): string => {
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

export const toBase64 = (input: Buffer): string => {
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
export const toURLBase64 = (input: Buffer | string): string => {
    assertType<Buffer | string>("Buffer | string", {
        input,
    });

    return (Buffer.isBuffer(input) ? input : fromHex(input))
        .toString("base64")
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/\=+$/, "");
};

const hasOwnProperty = <T>(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    object: any,
    property: keyof T,
): object is T => {
    return object.hasOwnProperty(property);
};

const invalidError = (errorMessage: string) =>
    errorMessage === "" ||
    errorMessage === "null" ||
    errorMessage === "undefined";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const extractError = (error: unknown): string => {
    if (error && typeof error === "object") {
        if (hasOwnProperty(error, "response") && error.response) {
            const extractedError = extractError(error.response);
            if (!invalidError(extractedError)) {
                return extractedError;
            }
        }
        if (hasOwnProperty(error, "data") && error.data) {
            const extractedError = extractError(error.data);
            if (!invalidError(extractedError)) {
                return extractedError;
            }
        }
        if (hasOwnProperty(error, "error") && error.error) {
            const extractedError = extractError(error.error);
            if (!invalidError(extractedError)) {
                return extractedError;
            }
        }
        if (hasOwnProperty(error, "context") && error.context) {
            const extractedError = extractError(error.context);
            if (!invalidError(extractedError)) {
                return extractedError;
            }
        }
        if (hasOwnProperty(error, "message") && error.message) {
            const extractedError = extractError(error.message);
            if (!invalidError(extractedError)) {
                return extractedError;
            }
        }
        if (hasOwnProperty(error, "statusText") && error.statusText) {
            const extractedError = extractError(error.statusText);
            if (!invalidError(extractedError)) {
                return extractedError;
            }
        }
    }
    try {
        if (typeof error === "string") {
            if (error.slice(0, 7) === "Error: ") {
                error = error.slice(7);
            }
            return error as string;
        }
        return JSON.stringify(error);
    } catch (innerError) {
        // Ignore JSON error
    }
    return String(error);
};

export const retryNTimes = async <T>(
    fnCall: () => Promise<T>,
    retries: number,
    timeout: number = 1 * SECONDS, // in ms
    logger?: Logger,
): Promise<T> => {
    let returnError;
    const errorMessages = new Set();
    for (let i = 0; retries === -1 || i < retries; i++) {
        try {
            return await fnCall();
        } catch (error) {
            // Fix error message.
            const errorMessage = extractError(error);
            errorMessages.add(errorMessage);
            returnError = error;

            if (i < retries || retries === -1) {
                await sleep(timeout);
                if (logger) {
                    logger.warn(error);
                }
            }
        }
    }

    returnError.message = Array.from(errorMessages).join(", ");

    throw returnError;
};

/**
 * Generates a random hex string (prefixed with '0x').
 *
 * @param bytes The number of bytes to generate.
 */
export const randomBytes = (bytes: number): Buffer => {
    try {
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        if (window) {
            const uints = new Uint32Array(bytes / 4); // 4 bytes (32 bits)
            // eslint-disable-next-line @typescript-eslint/ban-ts-comment
            // @ts-ignore
            window.crypto.getRandomValues(uints);
            let str = "";
            for (const uint of uints) {
                str +=
                    "0".repeat(8 - uint.toString(16).length) +
                    String(uint.toString(16));
            }
            return fromHex(str);
        }
    } catch (error) {
        // Ignore error
    }
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const crypto = require("crypto") as {
        randomBytes: (length: number) => Buffer;
    };
    return crypto.randomBytes(bytes);
};

/**
 * Returns a random 32 byte Buffer.
 */
export const randomNonce = (): Buffer => randomBytes(32);

export const emptyNonce = (): Buffer => fromHex("00".repeat(32));

export const rawEncode = (types: string[], parameters: unknown[]): Buffer =>
    fromHex(new AbiCoder().encodeParameters(types, parameters));
