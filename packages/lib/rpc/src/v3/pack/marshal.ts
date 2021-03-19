import { fromBase64 } from "@renproject/utils";
import BN from "bn.js";

import {
    PackPrimitive,
    PackStructType,
    PackType,
    PackTypeDefinition,
    TypedPackValue,
} from "./pack";

export const marshalPackType = (type: PackType) => {
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

export const marshalUint = (value: number, length: number) => {
    try {
        return new BN(
            typeof value === "number" ? value : (value as string).toString(),
        ).toArrayLike(Buffer, "be", length);
    } catch (error) {
        error.message = `Unable to marshal uint${
            length * 8
        } '${value}': ${String(error.message)}`;
        throw error;
    }
};

const marshalU = (length: number) => (value: number) =>
    marshalUint(value, length);
export const marshalU8 = marshalU(8 / 8);
export const marshalU16 = marshalU(16 / 8);
export const marshalU32 = marshalU(32 / 8);
export const marshalU64 = marshalU(64 / 8);
export const marshalU128 = marshalU(128 / 8);
export const marshalU256 = marshalU(256 / 8);

const withLength = (value: Buffer) =>
    Buffer.concat([marshalU32(value.length), value]);

export const marshalString = (value: string) => {
    return withLength(Buffer.from(value));
};

export const marshalPackStructType = (type: PackStructType) => {
    const length = marshalU32(type.struct.length);

    return Buffer.concat([
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

export const marshalPackTypeDefinition = (type: PackTypeDefinition): Buffer => {
    if (typeof type === "object") {
        return Buffer.concat([
            Buffer.from([marshalPackType("struct")]),
            marshalPackStructType(type),
        ]);
    } else if (typeof type === "string") {
        return Buffer.from([marshalPackType(type)]);
    }
    throw new Error(`Unable to marshal type ${String(type)}.`);
};

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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const marshalPackStruct = (type: PackStructType, value: any): Buffer => {
    return Buffer.concat(
        type.struct.map((member) => {
            const keys = Object.keys(member);
            if (keys.length === 0) {
                throw new Error(`Invalid struct member with no entries.`);
            }
            if (keys.length > 1) {
                throw new Error(`Invalid struct member with multiple entries.`);
            }
            const key = Object.keys(member)[0];
            const memberType = member[key];
            try {
                return marshalPackValue(memberType, value[key]);
            } catch (error) {
                error.message = `Unable to marshal struct field ${key}: ${String(
                    error.message,
                )}`;
                throw error;
            }
        }),
    );
};

export const marshalPackValue = (
    type: PackTypeDefinition,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    value: any,
): Buffer => {
    if (typeof type === "object") {
        return marshalPackStruct(type, value);
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

export const marshalTypedPackValue = ({ t, v }: TypedPackValue) => {
    const marshalledType = marshalPackTypeDefinition(t);
    const marshalledValue = marshalPackValue(t, v);
    return Buffer.concat([marshalledType, marshalledValue]);
};
