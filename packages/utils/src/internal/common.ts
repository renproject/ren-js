import BigNumber from "bignumber.js";
import BN from "bn.js";
import { OrderedMap, Record } from "immutable";

import { ErrorWithCode, RenJSError } from "../errors";
import { Web3PromiEvent } from "../libraries/promiEvent";
import { EventEmitterTyped, PromiEvent } from "../types/eventEmitter";
import { Logger } from "../types/logger";
import { assert, assertType } from "./assert";

/**
 * Pauses the thread for the specified number of milliseconds.
 *
 * @param ms The number of milliseconds to pause for.
 */
export const sleep = async (ms: number): Promise<void> => {
    return new Promise<void>((resolve) => setTimeout(resolve, ms));
};
sleep.SECONDS = 1000;
sleep.MINUTES = 60 * sleep.SECONDS;

/**
 * Attempt to call the provided function and retry if it errors. The function
 * is called up to a maximum `retries` times. If `retries` is `-1` then it
 * will be retried indefinitely.
 */
export const tryNTimes = async <T>(
    fnCall: () => Promise<T>,
    retries: number,
    timeout: number = 1 * sleep.SECONDS, // in ms
    logger?: Logger,
): Promise<T> => {
    if (retries === 0 || typeof retries !== "number" || isNaN(retries)) {
        throw ErrorWithCode.from(
            new Error(`Invalid retry amount '${retries}'.`),
            RenJSError.PARAMETER_ERROR,
        );
    }

    let returnError;
    const errorMessages = new Set();
    for (let i = 0; retries === -1 || i < retries; i++) {
        try {
            return await fnCall();
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } catch (error: any) {
            // console.error(extractError(error));
            // Fix error message.
            const errorMessage = extractError(error);
            errorMessages.add(errorMessage);
            returnError = error || returnError;

            if (i < retries - 1 || retries === -1) {
                await sleep(timeout);
                if (logger) {
                    logger.warn(error);
                }
            }
        }
    }

    if (returnError) {
        returnError.message = Array.from(errorMessages).join(", ");
    } else {
        returnError = new Error(Array.from(errorMessages).join(", "));
    }

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
export function toNBytes(
    input: BigNumber | Buffer | string | number,
    n: number,
    endian: "be" | "le" = "be",
): Buffer {
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
    ).toArrayLike(Buffer, endian, n);
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
}

export function fromBytes(
    input: Buffer,
    endian: "be" | "le" = "be",
): BigNumber {
    return new BigNumber(new BN(input, undefined, endian).toString());
}

/**
 * Cache the result of an asynchronous function, with a default expiry of 5
 * minutes. Only one result is stored at a time.
 */
export const memoize = <Params extends unknown[], Result>(
    fn: (...params: Params) => Promise<Result>,
    { expiry = (5 * sleep.MINUTES) as number | false, entryLimit = 100 } = {
        expiry: (5 * sleep.MINUTES) as number | false,
        entryLimit: 100,
    },
): ((...params: Params) => Promise<Result>) => {
    interface CacheRecordInner {
        timestamp: number;
        paramKey: string;
        result: Result;
    }

    const CacheRecord = Record<CacheRecordInner>({
        timestamp: 0,
        paramKey: null as never,
        result: null as never,
    });

    let cacheMap = OrderedMap<string, Record<CacheRecordInner>>();

    return async (...params: Params): Promise<Result> => {
        const paramKey = JSON.stringify(params);
        const cachedResult = cacheMap.get(paramKey);
        const currentTime = Date.now() / 1000;
        if (
            cachedResult &&
            (expiry === false ||
                currentTime - cachedResult.get("timestamp") < expiry) &&
            cachedResult.get("paramKey") === paramKey
        ) {
            return cachedResult.get("result");
        } else {
            const result = await fn(...params);

            // Update cache
            cacheMap = cacheMap.set(
                paramKey,
                CacheRecord({
                    timestamp: Date.now() / 1000,
                    paramKey,
                    result,
                }),
            );
            if (cacheMap.size > entryLimit) {
                cacheMap = cacheMap.slice(-entryLimit);
            }

            return result;
        }
    };
};

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
    hex: Buffer | string | number,
    { prefix } = { prefix: "0x" },
): string => {
    let hexString =
        typeof hex === "number"
            ? hex.toString(16)
            : typeof hex === "string"
            ? hex
            : hex.toString("hex");
    if (hexString.length % 2 === 1) {
        hexString = "0" + hexString;
    }
    return hexString.substring(0, 2) === prefix
        ? hexString
        : `${prefix}${hexString}`;
};

/**
 * Convert a hex string to a Buffer.
 */
export const fromHex = (hex: string): Buffer => {
    assertType<string>("string", { hex });
    return Buffer.from(strip0x(hex), "hex");
};

/**
 * Convert a base64 string to a Buffer.
 */
export const fromBase64 = (base64: string): Buffer => {
    assertType<string>("string", {
        base64,
    });
    return Buffer.from(base64, "base64");
};

/**
 * Unpadded alternate base64 encoding defined in RFC 4648, commonly used in
 * URLs.
 */
export const toURLBase64 = (input: Buffer): string => {
    assertType<Buffer>("Buffer", {
        input,
    });

    return (Buffer.isBuffer(input) ? Buffer.from(input) : fromHex(input))
        .toString("base64")
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=+$/, "");
};

export const isBase64 = doesntError(
    (
        input: string,
        options: {
            length?: number;
        } = {},
    ) => {
        const buffer = Buffer.from(input, "base64");
        assert(
            options.length === undefined || buffer.length === options.length,
            `Expected ${String(options.length)} bytes.`,
        );
        assert(buffer.toString("base64") === input);
    },
);

export const isURLBase64 = doesntError(
    (
        input: string,
        options: {
            length?: number;
        } = {},
    ) => {
        const buffer = Buffer.from(input, "base64");
        assert(
            options.length === undefined || buffer.length === options.length,
            `Expected ${String(options.length)} bytes.`,
        );
        assert(toURLBase64(buffer) === input);
    },
);

export const isHex = doesntError(
    (
        input: string,
        options: {
            prefix?: true;
            length?: number;
        } = {},
    ) => {
        if (options.prefix) {
            assert(input.slice(0, 2) === "0x");
            input = input.slice(2);
        }
        const buffer = Buffer.from(input, "hex");
        assert(
            options.length === undefined || buffer.length === options.length,
            `Expected ${String(options.length)} bytes.`,
        );
        assert(buffer.toString("hex") === input);
    },
);

/**
 * Helper function for creating new PromiEvents.
 */
export const newPromiEvent = <
    T,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    EventTypes extends { [event: string]: any[] } = {},
>(
    eventEmitter?: EventEmitterTyped<EventTypes>,
): PromiEvent<T, EventTypes> => new Web3PromiEvent<T, EventTypes>(eventEmitter);

export const hasOwnProperty = <T>(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    object: any,
    property: keyof T,
): object is T => object.hasOwnProperty(property);

export const invalidError = (errorMessage: string): boolean =>
    errorMessage === "" ||
    errorMessage === "null" ||
    errorMessage === "undefined";

/**
 * Attempt to extract a more meaningful error from a thrown error, such as
 * the body of a network response.
 */
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
