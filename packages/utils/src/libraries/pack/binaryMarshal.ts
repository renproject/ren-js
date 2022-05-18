import BigNumber from "bignumber.js";

import { ErrorWithCode, RenJSError } from "../../errors";
import { utils } from "../../internal";
import { isPackListType, isPackStructType } from "./common";
import {
    PackListType,
    PackPrimitive,
    PackStructType,
    PackTypeDefinition,
    TypedPackValue,
} from "./types";

// === Pack Types ==============================================================

/**
 * Convert a PackType string to its numeric ID, as defined in the Go reference
 * implementation.
 * (https://github.com/renproject/pack/blob/e0f417fbbd472eccd99e4bf304b19dc04a31a950/kind.go#L19)
 */
export const encodePackType = (type: PackTypeDefinition): number => {
    // Primitive types.
    switch (type) {
        case "nil":
            return 0;

        // KindBool is the kind of all Bool values.
        case PackPrimitive.Bool:
            return 1;
        // KindU8 is the kind of all U8 values.
        case PackPrimitive.U8:
            return 2;
        // KindU16 is the kind of all U16 values.
        case PackPrimitive.U16:
            return 3;
        // KindU32 is the kind of all U32 values.
        case PackPrimitive.U32:
            return 4;
        // KindU64 is the kind of all U64 values.
        case PackPrimitive.U64:
            return 5;
        // KindU128 is the kind of all U128 values.
        case PackPrimitive.U128:
            return 6;
        // KindU256 is the kind of all U256 values.
        case PackPrimitive.U256:
            return 7;

        // KindString is the kind of all utf8 strings.
        case PackPrimitive.Str:
            return 10;
        // KindBytes is the kind of all dynamic byte arrays.
        case PackPrimitive.Bytes:
            return 11;
        // KindBytes32 is the kind of all 32-byte arrays.
        case PackPrimitive.Bytes32:
            return 12;
        // KindBytes65 is the kind of all 65-byte arrays.
        case PackPrimitive.Bytes65:
            return 13;
    }

    // Complex types.
    if (typeof type === "object" && Object.keys(type).length === 1) {
        switch (Object.keys(type)[0]) {
            // KindStruct is the kind of all struct values. It is abstract, because it does
            // not specify the fields in the struct.
            case "struct":
                return 20;
            // KindList is the kind of all list values. It is abstract, because it does
            // not specify the type of the elements in the list.
            case "list":
                return 21;
        }
    }

    throw new Error(`Unknown type ${String(type)}.`);
};

/**
 * Convert a JavaScript number to a big-endian Uint8Array of the provided length.
 */
export const encodeUint = (
    value: BigNumber | string | number,
    bits: number,
): Uint8Array => {
    try {
        return utils.toNBytes(
            typeof value === "number"
                ? value
                : BigNumber.isBigNumber(value)
                ? value.toFixed()
                : value.toString(),
            bits / 8,
        );
    } catch (error: unknown) {
        throw ErrorWithCode.updateError(
            error,
            (error as ErrorWithCode).code || RenJSError.INTERNAL_ERROR,
            `Unable to encode uint${bits} '${String(value)}'`,
        );
    }
};

export const encodeU =
    (bits: number) =>
    (value: BigNumber | string | number): Uint8Array =>
        encodeUint(value, bits);
export const encodeU8 = encodeU(8);
export const encodeU16 = encodeU(16);
export const encodeU32 = encodeU(32);
export const encodeU64 = encodeU(64);
export const encodeU128 = encodeU(128);
export const encodeU256 = encodeU(256);

export const withLength = (value: Uint8Array): Uint8Array =>
    utils.concat([encodeU32(value.length), value]);

/**
 * Encode a string, prefixed by its length.
 */
export const encodeString = (value: string): Uint8Array =>
    withLength(utils.fromUTF8String(value));

/**
 * Encode a struct type by prefixing the `struct` pack type ID and the number
 * of struct entries, and then each field name followed by the field's
 * encoded type definition.
 */
export const encodePackStructType = (type: PackStructType): Uint8Array => {
    const length = encodeU32(type.struct.length);

    return utils.concat([
        new Uint8Array([encodePackType(type)]),
        length,
        ...type.struct.map((field) => {
            const keys = Object.keys(field);
            if (keys.length === 0) {
                throw new Error(`Invalid struct field with no entries.`);
            }
            if (keys.length > 1) {
                throw new Error(`Invalid struct field with multiple entries.`);
            }
            const key = Object.keys(field)[0];
            const fieldType = field[key];
            return utils.concat([
                encodeString(key),
                encodePackTypeDefinition(fieldType),
            ]);
        }),
    ]);
};

/**
 * Encode a list type by concatenating the `list` pack type ID followed by the
 * encoded type definition of the list's sub-type.
 */
export const encodePackListType = (type: PackListType): Uint8Array =>
    utils.concat([
        new Uint8Array([encodePackType(type)]),
        encodePackTypeDefinition(type.list),
    ]);

/**
 * Encode a pack type, as defined above for each type.
 */
export const encodePackTypeDefinition = (
    type: PackTypeDefinition,
): Uint8Array => {
    if (isPackStructType(type)) {
        return encodePackStructType(type);
    } else if (isPackListType(type)) {
        return encodePackListType(type);
    } else if (typeof type === "string") {
        return new Uint8Array([encodePackType(type)]);
    }
    throw new Error(`Unable to encode type ${String(type)}.`);
};

// === Pack Values =============================================================

/**
 * Encode a JavaScript value with an associated pack type into a Uint8Array.
 */
export const encodePackPrimitive = (
    type: PackPrimitive,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    value: any,
): Uint8Array => {
    switch (type) {
        // Booleans
        case PackPrimitive.Bool:
            return encodeU8(value ? 1 : 0);
        // Integers
        case PackPrimitive.U8:
            return encodeU8(value);
        case PackPrimitive.U16:
            return encodeU16(value);
        case PackPrimitive.U32:
            return encodeU32(value);
        case PackPrimitive.U64:
            return encodeU64(value);
        case PackPrimitive.U128:
            return encodeU128(value);
        case PackPrimitive.U256:
            return encodeU256(value);
        // Strings
        case PackPrimitive.Str: {
            return encodeString(value);
        }
        // Bytes
        case PackPrimitive.Bytes: {
            return withLength(
                value instanceof Uint8Array
                    ? value
                    : // Supports base64 url format
                      utils.fromBase64(value),
            );
        }
        case PackPrimitive.Bytes32:
        case PackPrimitive.Bytes65:
            return value instanceof Uint8Array
                ? value
                : // Supports base64 url format
                  utils.fromBase64(value);
    }
};

/**
 * Encode a pack struct by concatenating the encoded values of each of the
 * pack's fields.
 */
export const encodePackStruct = (
    type: PackStructType,
    value: unknown,
): Uint8Array =>
    utils.concat(
        type.struct.map((member) => {
            const keys = Object.keys(member);
            if (keys.length === 0) {
                throw new Error(`Invalid struct member with no entries.`);
            }
            if (keys.length > 1) {
                throw new Error(`Invalid struct member with multiple entries.`);
            }
            if (typeof value !== "object") {
                throw new Error(
                    `Invalid struct value of type "${typeof value}".`,
                );
            }
            if (value === null) {
                throw new Error(`Invalid struct value "null".`);
            }
            const key = Object.keys(member)[0];
            const memberType = member[key];
            try {
                return encodePackValue(memberType, value[key]);
            } catch (error: unknown) {
                throw ErrorWithCode.updateError(
                    error,
                    (error as ErrorWithCode).code || RenJSError.INTERNAL_ERROR,
                    `Unable to encode struct field ${key}`,
                );
            }
        }),
    );

/**
 * Encode a pack list by concatenating the encoded values of each of the
 * list's values.
 */
export const encodeListStruct = (
    type: PackListType,
    value: unknown[],
): Uint8Array => {
    const subtype = type.list;
    return utils.concat(
        value.map((element, i) => {
            try {
                return encodePackValue(subtype, element);
            } catch (error: unknown) {
                if (error instanceof Error) {
                    error.message = `Unable to encode array element #${i}: ${String(
                        error.message,
                    )}`;
                }
                throw error;
            }
        }),
    );
};

/**
 * Encode a pack value by using the encoding defined for the provided
 * pack type.
 */
export const encodePackValue = (
    type: PackTypeDefinition,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    value: any,
): Uint8Array => {
    if (isPackStructType(type)) {
        return encodePackStruct(type, value);
    } else if (isPackListType(type)) {
        return encodeListStruct(type, value);
    } else if (typeof type === "string") {
        if (type === "nil") return new Uint8Array();
        return encodePackPrimitive(type, value);
    }
    throw new Error(
        `Unknown value type ${String(type)}${
            !type ? ` for value ${String(value)}` : ""
        }`,
    );
};

/**
 * Encode a `{ t, v }` pair by concatenating the pack type-encoding of `t`
 * followed by the pack value-encoding of `v`.
 */
export const encodeTypedPackValue = ({ t, v }: TypedPackValue): Uint8Array => {
    try {
        const encodedType = encodePackTypeDefinition(t);
        const encodedValue = encodePackValue(t, v);
        return utils.concat([encodedType, encodedValue]);
    } catch (error: unknown) {
        if (error instanceof Error) {
            error.message = `Error encoding typed pack value: ${error.message}`;
            throw error;
        }
        throw new Error(
            `Error encoding typed pack value: ${utils.extractError(error)}`,
        );
    }
};
