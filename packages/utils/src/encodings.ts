import { assert, assertType } from "./assert";
import { doesntError } from "./common";

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
