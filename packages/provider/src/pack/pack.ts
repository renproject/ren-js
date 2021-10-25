import BigNumber from "bignumber.js";

import { fromBase64 } from "@renproject/utils";

export enum PackPrimitive {
    Bool = "bool",
    U8 = "u8",
    U16 = "u16",
    U32 = "u32",
    U64 = "u64",
    U128 = "u128",
    U256 = "u256",
    Str = "string",
    Bytes = "bytes",
    Bytes32 = "bytes32",
    Bytes65 = "bytes65",
}

export interface PackStructType<
    T extends Array<{ [name: string]: PackTypeDefinition }> = Array<{
        [name: string]: PackTypeDefinition;
    }>,
> {
    struct: T;
}

/**
 * Check that the passed-in value is a PackStructType - i.e. an object that has
 * a single field called `struct` which stores an array.
 */
export const isPackStructType = (type: unknown): type is PackStructType =>
    typeof type === "object" &&
    type !== null &&
    Object.keys(type).length === 1 &&
    (type as PackStructType).struct !== undefined &&
    Array.isArray((type as PackStructType).struct);

export interface PackListType<
    T extends PackTypeDefinition = PackTypeDefinition,
> {
    list: T;
}

/**
 * Check that the passed-in value is a PackListType - i.e. an object that has
 * a single field called `list`.
 */
export const isPackListType = (type: unknown): type is PackListType =>
    typeof type === "object" && (type as PackListType).list !== undefined;

export type PackNilType = "nil";

export type PackType = PackPrimitive | PackNilType | "list" | "struct";

export type MarshalledPackArray<T> = T[];
export type MarshalledPackStruct<T extends object> = T;

export type Marshalled<Type extends PackType> = Type extends PackPrimitive.Bool
    ? boolean
    : Type extends PackPrimitive.U8
    ? string
    : Type extends PackPrimitive.U16
    ? string
    : Type extends PackPrimitive.U32
    ? string
    : Type extends PackPrimitive.U64
    ? string
    : Type extends PackPrimitive.U128
    ? string
    : Type extends PackPrimitive.U256
    ? string
    : Type extends PackPrimitive.Str
    ? string
    : Type extends PackPrimitive.Bytes
    ? string
    : Type extends PackPrimitive.Bytes32
    ? string
    : Type extends PackPrimitive.Bytes65
    ? string
    : Type extends PackNilType
    ? string
    : Type extends "list"
    ? // eslint-disable-next-line @typescript-eslint/no-explicit-any
      any[]
    : Type extends "struct"
    ? // eslint-disable-next-line @typescript-eslint/no-explicit-any
      any
    : never;

export type Unmarshalled<Type extends PackType> =
    Type extends PackPrimitive.Bool
        ? boolean
        : Type extends PackPrimitive.U8
        ? BigNumber
        : Type extends PackPrimitive.U16
        ? BigNumber
        : Type extends PackPrimitive.U32
        ? BigNumber
        : Type extends PackPrimitive.U64
        ? BigNumber
        : Type extends PackPrimitive.U128
        ? BigNumber
        : Type extends PackPrimitive.U256
        ? BigNumber
        : Type extends PackPrimitive.Str
        ? string
        : Type extends PackPrimitive.Bytes
        ? Buffer
        : Type extends PackPrimitive.Bytes32
        ? Buffer
        : Type extends PackPrimitive.Bytes65
        ? Buffer
        : Type extends PackNilType
        ? undefined
        : Type extends "list"
        ? // eslint-disable-next-line @typescript-eslint/no-explicit-any
          any[]
        : Type extends "struct"
        ? // eslint-disable-next-line @typescript-eslint/no-explicit-any
          any
        : never;

export type PackTypeDefinition =
    | PackPrimitive
    | PackStructType
    | PackListType
    | PackNilType;

export interface TypedPackValue<
    T extends PackTypeDefinition = PackTypeDefinition,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    V = any,
> {
    t: T;
    v: V;
}

/**
 * Takes a pack primitive value (bool, uint, string or bytes) and convert it to
 * its corresponding JavaScript value (bool, BigNumber, string or Buffer).
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const unmarshalPackPrimitive = (type: PackPrimitive, value: any) => {
    switch (type) {
        // Booleans
        case PackPrimitive.Bool:
            return value;
        // Integers
        case PackPrimitive.U8:
        case PackPrimitive.U16:
        case PackPrimitive.U32:
        case PackPrimitive.U64:
        case PackPrimitive.U128:
        case PackPrimitive.U256:
            return new BigNumber(value);
        // Strings
        case PackPrimitive.Str:
            return value;
        // Bytes
        case PackPrimitive.Bytes:
        case PackPrimitive.Bytes32:
        case PackPrimitive.Bytes65:
            return fromBase64(value);
    }
};

/**
 * Takes a pack struct and converts it to a JavaScript object.
 */
export const unmarshalPackStruct = (type: PackStructType, value: object) => {
    const struct = {};

    for (const member of type.struct) {
        const keys = Object.keys(member);
        if (keys.length === 0) {
            throw new Error(`Invalid struct member with no entries.`);
        }
        if (keys.length > 1) {
            throw new Error(`Invalid struct member with multiple entries.`);
        }
        const key = Object.keys(member)[0];
        const memberType = member[key];

        if (value && !value.hasOwnProperty(key)) {
            throw new Error(`Missing pack value for key ${key}.`);
        }

        struct[key] = unmarshalPackValue(memberType, value[key]);
    }

    return struct;
};

/**
 * Unmarshals a pack list.
 */
export const unmarshalPackList = <T extends unknown>(
    type: PackListType,
    value: T[],
): T[] => value.map((element) => unmarshalPackValue(type.list, element));

/**
 * Converts the passed-in value to its corresponding JavaScript value based on
 * the passed-in type.
 */
export const unmarshalPackValue = (
    type: PackTypeDefinition,
    value: unknown,
) => {
    if (isPackListType(type)) {
        return unmarshalPackList(type, value as unknown[]);
    } else if (isPackStructType(type)) {
        return unmarshalPackStruct(type, value as object);
    } else if (typeof type === "string") {
        if (type === "nil") return null;
        return unmarshalPackPrimitive(type, value);
    }
    let valueString: string;
    try {
        valueString = JSON.stringify(value);
    } catch (_error) {
        valueString = String(value);
    }
    if (valueString.length > 20) {
        valueString = `${valueString.slice(0, 17)}...`;
    }
    throw new Error(
        `Unknown value type ${String(type)}${
            !type ? ` for value ${valueString}` : ""
        }.`,
    );
};

/**
 * Converts a { t, v } pack object, using `t` as a pack type and `v` as a pack
 * value.
 */
export const unmarshalTypedPackValue = ({ t, v }: TypedPackValue) =>
    unmarshalPackValue(t, v);
