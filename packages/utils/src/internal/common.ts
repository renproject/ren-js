import * as base64 from "base64-js";
import BigNumber from "bignumber.js";
import { OrderedMap, Record } from "immutable";

import { ErrorWithCode, RenJSError } from "../errors";
import { Web3PromiEvent } from "../libraries/promiEvent";
import { EventEmitterTyped, PromiEvent } from "../types/eventEmitter";
import { Logger } from "../types/logger";
import { assert, assertType } from "./assert";
import { extractError } from "./extractError";
import { sleep } from "./sleep";

/**
 * Attempt to call the provided function and retry if it errors. The function
 * is called up to a maximum `retries` times. If `retries` is `-1` then it
 * will be retried indefinitely.
 */
export const tryNTimes = async <T>(
    fnCall: (attempt: number, retries: number) => Promise<T>,
    retries: number,
    timeout: number = 1 * sleep.SECONDS, // in ms
    logger?: Logger,
): Promise<T> => {
    if (retries === 0 || typeof retries !== "number" || isNaN(retries)) {
        throw ErrorWithCode.updateError(
            new Error(`Invalid retry amount '${retries}'.`),
            RenJSError.PARAMETER_ERROR,
        );
    }

    let returnError: Error | undefined;
    const errorMessages = new Set();
    for (let i = 0; retries === -1 || i < retries; i++) {
        try {
            return await fnCall(i, retries);
        } catch (error: unknown) {
            // console.error(extractError(error));
            // Fix error message.
            const errorMessage = extractError(error);
            errorMessages.add(errorMessage);
            returnError =
                ErrorWithCode.updateError(
                    error,
                    (error as ErrorWithCode).code || RenJSError.INTERNAL_ERROR,
                ) || returnError;

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

export const tryIndefinitely = async <T>(
    fnCall: (attempt: number, retries: number) => Promise<T>,
): Promise<T> => tryNTimes(fnCall, -1, 15 * sleep.SECONDS, console);

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
        } catch (error: unknown) {
            return false;
        }
    };

/**
 * Pad a Uint8Array to `n` bytes. If the Uint8Array is longer than `n` bytes, an error
 * is thrown.
 */
export const padUint8Array = (array: Uint8Array, n: number): Uint8Array => {
    if (array.length > n) {
        throw new Error(
            `byte array longer than desired length (${String(
                array.length,
            )} > ${String(n)})`,
        );
    }

    if (array.length < n) {
        const paddingLength = n - array.length;
        const padding = Array.from(new Array(paddingLength)).map((_) => 0);
        array = concat([new Uint8Array(padding), array]);
    }

    return array;
};

/**
 * Convert a number to a Uint8Array of length `n`.
 */
export const toNBytes = (
    input: BigNumber | Uint8Array | string | number,
    n: number,
    endian: "be" | "le" = "be",
): Uint8Array => {
    let bytes;
    if (input instanceof Uint8Array) {
        bytes = input;
    } else {
        let hex = new BigNumber(input).toString(16);
        hex = hex.length % 2 ? "0" + hex : hex;
        bytes = fromHex(hex);
    }

    bytes = padUint8Array(bytes, n);

    // Check if the bytes need to be flipped.
    if (endian === "le") {
        bytes = new Uint8Array(bytes).reverse();
    }

    return bytes;
};

export const fromBytes = (
    input: Uint8Array,
    endian: "be" | "le" = "be",
): BigNumber => {
    return new BigNumber(
        toHex(endian === "be" ? input : new Uint8Array(input).reverse()),
        16,
    );
};

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
 * Convert a Uint8Array to a hex string (with no "0x"-prefix).
 */
export const toHex = (array: Uint8Array): string =>
    array.reduce((str, byte) => str + byte.toString(16).padStart(2, "0"), "");

/**
 * Add a 0x prefix to a hex value, converting to a string first. If the input
 * is already prefixed, it's returned unchanged.
 *
 * @param hexInput The hex value to be prefixed.
 */
export const Ox = (
    hexInput: Uint8Array | string | number,
    { prefix } = { prefix: "0x" },
): string => {
    let hexString: string =
        hexInput instanceof Uint8Array
            ? toHex(hexInput)
            : typeof hexInput === "number"
            ? hexInput.toString(16)
            : hexInput;

    if (hexString.length % 2 === 1) {
        hexString = "0" + hexString;
    }
    return hexString.substring(0, 2) === prefix
        ? hexString
        : `${prefix}${hexString}`;
};

/**
 * Convert a hex string to a Uint8Array.
 */
export const fromHex = (hexString: string): Uint8Array => {
    assertType<string>("string", { hex: hexString });

    // Strip "0x" prefix.
    hexString = strip0x(hexString);

    // Pad the hex string.
    if (hexString.length % 2) {
        hexString = "0" + hexString;
    }

    // Split the string into bytes.
    const match = hexString.match(/.{1,2}/g);
    if (!match) {
        return new Uint8Array();
    }

    // Parse each byte and create a Uint8Array.
    return new Uint8Array(match.map((byte) => parseInt(byte, 16)));
};

export const toUTF8String = (input: Uint8Array): string => {
    let output = "";
    for (const characterCode of input) {
        let hexCode: string = characterCode.toString(16);

        // Pad characterCode.
        if (hexCode.length < 2) {
            hexCode = "0" + hexCode;
        }

        // Add character to output.
        output += "%" + hexCode;
    }
    return decodeURIComponent(output);
};

export const fromUTF8String = (input: string): Uint8Array => {
    const a = [];
    const encodedInput = encodeURIComponent(input);
    for (let i = 0; i < encodedInput.length; i++) {
        if (encodedInput[i] === "%") {
            // Load the next two characters of encodedInput and treat them
            // as a UTF-8 code.
            a.push(parseInt(encodedInput.substr(i + 1, 2), 16));
            i += 2;
        } else {
            a.push(encodedInput.charCodeAt(i));
        }
    }
    return new Uint8Array(a);
};

/**
 * Convert a base64 string to a Uint8Array.
 */
export const fromBase64 = (base64String: string): Uint8Array => {
    assertType<string>("string", {
        base64: base64String,
    });
    // Add padding at the end, as required by the base64-js library.
    if (base64String.length % 4 !== 0) {
        base64String += "=".repeat(4 - (base64String.length % 4));
    }
    return base64.toByteArray(base64String);
};

export const toBase64 = (input: Uint8Array): string => {
    assertType<Uint8Array>("Uint8Array", {
        input,
    });

    return base64.fromByteArray(input);
};

/**
 * Unpadded alternate base64 encoding defined in RFC 4648, commonly used in
 * URLs.
 */
export const toURLBase64 = (input: Uint8Array): string => {
    assertType<Uint8Array>("Uint8Array", {
        input,
    });

    return toBase64(input)
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
        const array = fromBase64(input);
        assert(
            options.length === undefined || array.length === options.length,
            `Expected ${String(options.length)} bytes.`,
        );
        assert(toBase64(array) === input);
    },
);

export const isURLBase64 = doesntError(
    (
        input: string,
        options: {
            length?: number;
        } = {},
    ) => {
        const array = fromBase64(input);
        assert(
            options.length === undefined || array.length === options.length,
            `Expected ${String(options.length)} bytes.`,
        );
        assert(toURLBase64(array) === input);
    },
);

export const isHex = doesntError(
    (
        input: string,
        options: {
            prefix?: true;
            length?: number;
            uppercase?: boolean;
        } = {},
    ) => {
        if (options.prefix) {
            assert(input.slice(0, 2) === "0x");
            input = input.slice(2);
        }
        const bytes = fromHex(input);
        assert(
            options.length === undefined || bytes.length === options.length,
            `Expected ${String(options.length)} bytes.`,
        );
        let hex = Ox(bytes, { prefix: "" });
        if (options.uppercase) {
            hex = hex.toUpperCase();
        }
        assert(hex === input);
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

/**
 * Concatenate an array of Uint8Arrays into a single Uint8Array.
 *
 * @param uint8Arrays One or more Uint8Arrays.
 * @returns A single Uint8Array containing the values of each input array,
 * in the same order as the inputs.
 */
export const concat = (uint8Arrays: Uint8Array[]): Uint8Array => {
    const concatenated = uint8Arrays.reduce((acc, curr) => {
        acc.push(...curr);
        return acc;
    }, [] as number[]);

    return new Uint8Array(concatenated);
};
