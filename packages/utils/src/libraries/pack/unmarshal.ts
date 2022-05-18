/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Takes a pack primitive value (bool, uint, string or bytes) and convert it to
 * its corresponding JavaScript value (bool, BigNumber, string or Uint8Array).
 */

import BigNumber from "bignumber.js";

import { utils } from "../../internal";
import { isPackListType, isPackStructType } from "./common";
import {
    PackListType,
    PackPrimitive,
    PackStructType,
    PackTypeDefinition,
    TypedPackValue,
    Unmarshalled,
} from "./types";

export const unmarshalPackPrimitive = <T extends PackPrimitive = PackPrimitive>(
    type: T,

    value: any,
): Unmarshalled<T> => {
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
            return new BigNumber(value) as Unmarshalled<T>;
        // Strings
        case PackPrimitive.Str:
            return value;
        // Bytes
        case PackPrimitive.Bytes:
        case PackPrimitive.Bytes32:
        case PackPrimitive.Bytes65:
            return utils.fromBase64(value) as Unmarshalled<T>;
    }
    throw new Error(`Unknown pack type '${type}'.`);
};

/**
 * Takes a pack struct and converts it to a JavaScript object.
 */
export const unmarshalPackStruct = <T extends PackStructType = PackStructType>(
    type: T,
    value: object,
): any => {
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
export const unmarshalPackList = <T>(type: PackListType, value: T[]): any[] =>
    value.map((element) => unmarshalPackValue(type.list, element));

/**
 * Converts the passed-in value to its corresponding JavaScript value based on
 * the passed-in type.
 */
export const unmarshalPackValue = <
    T extends PackTypeDefinition = PackTypeDefinition,
>(
    type: T,
    value: unknown,
): any => {
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
export const unmarshalTypedPackValue = ({ t, v }: TypedPackValue): any => {
    try {
        return unmarshalPackValue(t, v);
    } catch (error: unknown) {
        console.error(error);
        if (error instanceof Error) {
            error.message = `Error unmarshalling typed pack value: ${error.message}`;
            throw error;
        }
        throw new Error(
            `Error unmarshalling typed pack value: ${utils.extractError(
                error,
            )}`,
        );
    }
};
