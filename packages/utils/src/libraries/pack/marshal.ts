import BigNumber from "bignumber.js";

import { fromBase64, toNBytes } from "../../internal/common";
import { isPackListType, isPackStructType } from "./common";
import {
    PackListType,
    PackPrimitive,
    PackStructType,
    PackType,
    PackTypeDefinition,
    TypedPackValue,
} from "./types";

// === Pack Types ==============================================================

/**
 * Convert a PackType string to its numeric ID, as defined in the Go reference
 * implementation.
 * (https://github.com/renproject/pack/blob/e0f417fbbd472eccd99e4bf304b19dc04a31a950/kind.go#L19)
 */
export const marshalPackType = (type: PackType): number => {
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

        // KindStruct is the kind of all struct values. It is abstract, because it does
        // not specify the fields in the struct.
        case "struct":
            return 20;
        // KindList is the kind of all list values. It is abstract, because it does
        // not specify the type of the elements in the list.
        case "list":
            return 21;
    }
    throw new Error(`Unknown type ${String(type)}.`);
};

/**
 * Convert a JavaScript number to a big-endian Buffer of the provided length.
 */
export const marshalUint = (
    value: BigNumber | string | number,
    bits: number,
): Buffer => {
    try {
        return toNBytes(
            typeof value === "number"
                ? value
                : BigNumber.isBigNumber(value)
                ? value.toFixed()
                : value.toString(),
            bits / 8,
        );
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
        if (error instanceof Error) {
            error.message = `Unable to marshal uint${bits} '${String(
                value,
            )}': ${String(error.message)}`;
        }
        throw error;
    }
};

export const marshalU =
    (bits: number) => (value: BigNumber | string | number) =>
        marshalUint(value, bits);
export const marshalU8 = marshalU(8);
export const marshalU16 = marshalU(16);
export const marshalU32 = marshalU(32);
export const marshalU64 = marshalU(64);
export const marshalU128 = marshalU(128);
export const marshalU256 = marshalU(256);

export const withLength = (value: Buffer) =>
    Buffer.concat([marshalU32(value.length), value]);

/**
 * Marshal a string, prefixed by its length.
 */
export const marshalString = (value: string): Buffer =>
    withLength(Buffer.from(value));

/**
 * Marshal a struct type by prefixing the `struct` pack type ID and the number
 * of struct entries, and then each field name followed by the field's
 * marshalled type definition.
 */
export const marshalPackStructType = (type: PackStructType): Buffer => {
    const length = marshalU32(type.struct.length);

    return Buffer.concat([
        Buffer.from([marshalPackType("struct")]),
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
            return Buffer.concat([
                marshalString(key),
                marshalPackTypeDefinition(fieldType),
            ]);
        }),
    ]);
};

/**
 * Marshal a list type by concatenating the `list` pack type ID followed by the
 * marshalled type definition of the list's sub-type.
 */
export const marshalPackListType = (type: PackListType): Buffer =>
    Buffer.concat([
        Buffer.from([marshalPackType("list")]),
        marshalPackTypeDefinition(type.list),
    ]);

/**
 * Marshal a pack type, as defined above for each type.
 */
export const marshalPackTypeDefinition = (type: PackTypeDefinition): Buffer => {
    if (isPackStructType(type)) {
        return marshalPackStructType(type);
    } else if (isPackListType(type)) {
        return marshalPackListType(type);
    } else if (typeof type === "string") {
        return Buffer.from([marshalPackType(type)]);
    }
    throw new Error(`Unable to marshal type ${String(type)}.`);
};

// === Pack Values =============================================================

/**
 * Marshal a JavaScript value with an associated pack type into a Buffer.
 */
export const marshalPackPrimitive = (
    type: PackPrimitive,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    value: any,
): Buffer => {
    switch (type) {
        // Booleans
        case PackPrimitive.Bool:
            return marshalU8(value ? 1 : 0);
        // Integers
        case PackPrimitive.U8:
            return marshalU8(value);
        case PackPrimitive.U16:
            return marshalU16(value);
        case PackPrimitive.U32:
            return marshalU32(value);
        case PackPrimitive.U64:
            return marshalU64(value);
        case PackPrimitive.U128:
            return marshalU128(value);
        case PackPrimitive.U256:
            return marshalU256(value);
        // Strings
        case PackPrimitive.Str: {
            return marshalString(value);
        }
        // Bytes
        case PackPrimitive.Bytes: {
            return withLength(
                Buffer.isBuffer(value)
                    ? Buffer.from(value)
                    : // Supports base64 url format
                      fromBase64(value),
            );
        }
        case PackPrimitive.Bytes32:
        case PackPrimitive.Bytes65:
            return Buffer.isBuffer(value)
                ? Buffer.from(value)
                : // Supports base64 url format
                  fromBase64(value);
    }
};

/**
 * Marshal a pack struct by concatenating the marshalled values of each of the
 * pack's fields.
 */
export const marshalPackStruct = (
    type: PackStructType,
    value: unknown,
): Buffer =>
    Buffer.concat(
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
                return marshalPackValue(memberType, value[key]);
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
            } catch (error: any) {
                if (error instanceof Error) {
                    error.message = `Unable to marshal struct field ${key}: ${String(
                        error.message,
                    )}`;
                }
                throw error;
            }
        }),
    );

/**
 * Marshal a pack list by concatenating the marshalled values of each of the
 * list's values.
 */
export const marshalListStruct = (
    type: PackListType,
    value: unknown[],
): Buffer => {
    const subtype = type.list;
    return Buffer.concat(
        value.map((element, i) => {
            try {
                return marshalPackValue(subtype, element);
            } catch (error: unknown) {
                if (error instanceof Error) {
                    error.message = `Unable to marshal array element #${i}: ${String(
                        error.message,
                    )}`;
                }
                throw error;
            }
        }),
    );
};

/**
 * Marshal a pack value by using the marshalling defined for the provided
 * pack type.
 */
export const marshalPackValue = (
    type: PackTypeDefinition,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    value: any,
): Buffer => {
    if (isPackStructType(type)) {
        return marshalPackStruct(type, value);
    } else if (isPackListType(type)) {
        return marshalListStruct(type, value);
    } else if (typeof type === "string") {
        if (type === "nil") return Buffer.from([]);
        return marshalPackPrimitive(type, value);
    }
    throw new Error(
        `Unknown value type ${String(type)}${
            !type ? ` for value ${String(value)}` : ""
        }`,
    );
};

/**
 * Marshal a `{ t, v }` pair by concatenating the pack type-marshalling of `t`
 * followed by the pack value-marshalling of `v`.
 */
export const marshalTypedPackValue = ({ t, v }: TypedPackValue): Buffer => {
    const marshalledType = marshalPackTypeDefinition(t);
    const marshalledValue = marshalPackValue(t, v);
    return Buffer.concat([marshalledType, marshalledValue]);
};
