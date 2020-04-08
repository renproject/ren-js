import { EthArgs, Ox, strip0x } from "@renproject/interfaces";
import BigNumber from "bignumber.js";
import { crypto } from "bitcore-lib";
import { AbiCoder } from "web3-eth-abi";

export const unzip = (zip: EthArgs) => [zip.map(param => param.type), zip.map(param => param.value)];

export const SECONDS = 1000;
// tslint:disable-next-line: no-string-based-set-timeout
export const sleep = async (milliseconds: number) => new Promise((resolve) => setTimeout(resolve, milliseconds));

export const toBase64 = (input: string | Buffer) =>
    (Buffer.isBuffer(input) ? input : Buffer.from(strip0x(input), "hex")).toString("base64");

// tslint:disable-next-line: no-any
export const ignoreError = (error: any): boolean => {
    try {
        return (error && error.message && (
            error.message.match(/Invalid block number/) ||
            error.message.match(/Timeout exceeded during the transaction confirmation process./)
        ));
    } catch (error) {
        return false;
    }
};

// tslint:disable-next-line: no-any
export const extractError = (error: any): string => {
    if (typeof error === "object") {
        if (error.response) { return extractError(error.response); }
        if (error.data) { return extractError(error.data); }
        if (error.error) { return extractError(error.error); }
        if (error.message) { return extractError(error.message); }
        if (error.statusText) { return extractError(error.statusText); }
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

export const retryNTimes = async <T>(fnCall: () => Promise<T>, retries: number): Promise<T> => {
    let returnError;
    // tslint:disable-next-line: no-constant-condition
    for (let i = 0; retries === -1 || i < retries; i++) {
        // if (i > 0) {
        //     console.debug(`Retrying...`);
        // }
        try {
            return await fnCall();
        } catch (error) {
            const errorMessage = extractError(error);
            if (errorMessage.match(/timeout of .* exceeded/)) {
                returnError = error;
            } else {
                if (errorMessage) {
                    error.message += ` (${errorMessage})`;
                }
                returnError = error;
            }
        }
    }
    throw returnError;
};

/**
 * Generates a random hex string (prefixed with '0x').
 * @param bytes The number of bytes to generate.
 */
export const randomBytes = (bytes: number): string => {
    try {
        // @ts-ignore
        if (window) {
            const uints = new Uint32Array(bytes / 4); // 4 bytes (32 bits)
            // @ts-ignore
            window.crypto.getRandomValues(uints);
            let str = "";
            for (const uint of uints) {
                str += "0".repeat(8 - uint.toString(16).length) + uint.toString(16);
            }
            return Ox(str);
        }
    } catch (error) {
        // Ignore error
    }
    return Ox(crypto.Random.getRandomBuffer(bytes));
};

export const toBigNumber = (n: BigNumber | { toString(): string }) => BigNumber.isBigNumber(n) ? new BigNumber(n.toFixed()) : new BigNumber(n.toString());

export const assert = (assertion: boolean, sentence?: string): assertion is true => {
    if (!assertion) {
        throw new Error(`Failed assertion${sentence ? `: ${sentence}` : ""}`);
    }
    return true;
};
