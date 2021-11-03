import BigNumber from "bignumber.js";
import BN from "bn.js";

import { extractError } from "./errors";
import { Logger } from "./interfaces/logger";

/**
 * Represents 1 second for functions that accept a parameter in milliseconds.
 */
export const SECONDS = 1000;
export const MINUTES = 60 * SECONDS;

/**
 * Pauses the thread for the specified number of milliseconds.
 *
 * @param ms The number of milliseconds to pause for.
 */
export const sleep = async (ms: number): Promise<void> =>
    new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * Attempt to call the provided function and retry if it errors. The function
 * is called up to a maximum `retries` times. If `retries` is `-1` then it
 * will be retried indefinitely.
 */
export const tryNTimes = async <T>(
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
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } catch (error: any) {
            // Fix error message.
            const errorMessage = extractError(error);
            errorMessages.add(errorMessage);
            returnError = error;

            if (i < retries - 1 || retries === -1) {
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
 * isDefined returns true if the parameter is defined and not null.
 */
export const isDefined = <T>(x: T | null | undefined): x is T =>
    x !== null && x !== undefined;

/**
 * Returns false if the method throws or returns false - returns true otherwise.
 */
export const doesntError =
    <T extends unknown[]>(f: (...p: T) => boolean | void) =>
    (...p: T): boolean => {
        try {
            const response = f(...p);
            return response === undefined || response === true ? true : false;
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } catch (error: any) {
            return false;
        }
    };

/**
 * Pad a Buffer to `n` bytes. If the Buffer is longer than `n` bytes, an error
 * is thrown.
 */
export const padBuffer = (buffer: Buffer, n: number): Buffer => {
    if (buffer.length > n) {
        throw new Error(
            `byte array longer than desired length (${String(
                buffer.length,
            )} > ${String(n)})`,
        );
    }

    if (buffer.length < n) {
        const paddingLength = n - buffer.length;
        const padding = Array.from(new Array(paddingLength)).map((_) => 0);
        buffer = Buffer.concat([Buffer.from(padding), buffer]);
    }

    return buffer;
};

/**
 * Convert a number to a Buffer of length `n`.
 */
export const toNBytes = (
    input: BigNumber | Buffer | string | number,
    n: number,
): Buffer => {
    let buffer;
    if (Buffer.isBuffer(input)) {
        buffer = input;
    } else {
        let hex = new BigNumber(input).toString(16);
        hex = hex.length % 2 ? "0" + hex : hex;
        buffer = Buffer.from(hex, "hex");
    }

    buffer = padBuffer(buffer, n);

    const bnVersion = new BN(
        BigNumber.isBigNumber(input) ? input.toFixed() : input,
    ).toArrayLike(Buffer, "be", n);
    if (!buffer.equals(bnVersion) || buffer.length !== n) {
        throw new Error(
            `Failed to convert to ${String(n)}-length bytes - got ${String(
                buffer.toString("hex"),
            )} (${String(buffer.length)} bytes), expected ${bnVersion.toString(
                "hex",
            )} (${String(bnVersion.length)} bytes)`,
        );
    }

    return buffer;
};
