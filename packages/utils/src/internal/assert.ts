/* eslint-disable security/detect-object-injection */

import BigNumber from "bignumber.js";

/**
 * Throw an error if the assertion is false.
 */
export const assert = (
    assertion: boolean,
    sentence?: string,
): assertion is true => {
    if (!assertion) {
        throw new Error(`Failed assertion${sentence ? `: ${sentence}` : ""}`);
    }
    return true;
};

/**
 * The following is a set of rudimentary type validation functions.
 *
 * The main function is `assertType`, which accepts a type and a dictionary of
 * values.
 *
 * The type must be a string that matches the following pattern:
 *
 * ```
 * TYPE:
 *   | TYPE '|' TYPE
 *   | Array<TYPE>
 *   | TYPE[]
 *   | PRIMITIVE_TYPE
 *
 * PRIMITIVE_TYPE:
 *   | "string"
 *   | "number"
 *   | "bigint"
 *   | "boolean"
 *   | "symbol"
 *   | "undefined"
 *   | "object"
 *   | "function"
 *   | "null"
 *   | "any"
 *   | "Uint8Array"
 *   | "BigNumber"
 * ```
 *
 * Types are matched by a regex so '|' can't be used at multiple levels, e.g.
 * `string | Array<string | number>`.
 */
export const assertType = <
    // Type extends string,
    // T = Type extends "Uint8Array" ? Uint8Array : any
    T = unknown,
>(
    type: string,
    objects: {
        [value: string]: T;
    },
): objects is { [value: string]: T } => {
    if (isArrayType(type)) {
        return assertArray(
            type,
            objects as unknown as { [value: string]: T[] },
        );
    }
    if (isUnionType(type)) {
        return assertTypeUnion(type, objects);
    }

    return assertTypeCheck(is(type as PrimitiveTypeName), objects, type);
};

type PrimitiveTypeName =
    | "string"
    | "number"
    | "bigint"
    | "boolean"
    | "symbol"
    | "undefined"
    | "object"
    | "function"
    | "null"
    | "any"
    | "BigNumber"
    | "Uint8Array";

const typeOf = (v: unknown): PrimitiveTypeName =>
    v === null
        ? "null"
        : BigNumber.isBigNumber(v)
        ? "BigNumber"
        : v instanceof Uint8Array
        ? "Uint8Array"
        : typeof v;

const assertTypeCheck = <T = unknown>(
    type: (t: unknown, key: string) => boolean,
    objects: {
        [value: string]: T;
    },
    typeDescription: string,
): objects is { [value: string]: T } => {
    for (const key of Object.keys(objects)) {
        // eslint-disable-next-line security/detect-object-injection
        const value = objects[key];
        if (!type(value, key)) {
            const readableType = Array.isArray(value) ? "any[]" : typeOf(value);
            throw new Error(
                `Expected '${key}' to be of type '${typeDescription}', instead got '${readableType}'.`,
            );
        }
    }
    return true;
};

const is = (type: PrimitiveTypeName) => (v: unknown) =>
    type === "any" ? true : typeOf(v) === type;

const isUnionType = (unionType: string): string[] | false => {
    const types = unionType.split(" | ") as PrimitiveTypeName[];
    return types.length > 1 ? types : false;
};

const isArrayType = (arrayType: string): string | false => {
    // Check with simple string operations to avoid running slow RegExs if there
    // isn't a match.

    const isArray =
        arrayType.slice(0, 6) === "Array<" && arrayType.slice(-1) === ">";

    if (isArray) {
        const arrayMatch = /^Array<(.*)>$/.exec(arrayType);
        if (arrayMatch) {
            const [, type] = arrayMatch;
            return type;
        }
    }

    const isBracketArray =
        arrayType.indexOf(" ") === -1 && arrayType.slice(-2) === "[]";
    if (isBracketArray) {
        const bracketMatch = /^([^ ]*)\[\]$/.exec(arrayType);
        if (bracketMatch) {
            const [, type] = bracketMatch;
            return type;
        }
    }
    return false;
};

const assertTypeUnion = <T = unknown>(
    unionType: string,
    objects: {
        [value: string]: T;
    },
): objects is { [value: string]: T } => {
    const types = unionType.split(" | ") as PrimitiveTypeName[];
    return assertTypeCheck(
        (v, key) =>
            types.reduce<boolean>((acc, type) => {
                if (acc) {
                    return acc;
                }
                if (isArrayType(type)) {
                    try {
                        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
                        assertArray(type, { [key]: v as unknown[] });
                        return true;
                    } catch (error: unknown) {
                        return false;
                    }
                }
                return is(type)(v);
            }, false),
        objects,
        unionType,
    );
};

const assertArray = <T = unknown>(
    arrayType: string,
    objects: {
        [value: string]: T[];
    },
): objects is { [value: string]: T[] } => {
    const type = isArrayType(arrayType);
    if (!type) {
        /* istanbul ignore next */ /* also checked when assertArray is called */
        throw new Error(`Invalid array type ${arrayType}`);
    }

    for (const key of Object.keys(objects)) {
        const value = objects[key];
        assertTypeCheck((v) => Array.isArray(v), { value }, "any[]");

        for (let i = 0; i < value.length; i++) {
            assertType(type, { [`${key}[${i}]`]: value[i] });
        }
    }
    return true;
};

declare type ObjectDefinition<T> = {
    [P in keyof T]: string | ObjectDefinition<unknown>;
};

export const assertObject = <T extends object>(
    fieldTypes: ObjectDefinition<T>,
    objects: { [key: string]: T },
): boolean => {
    for (const key of Object.keys(objects)) {
        const value = objects[key];

        for (const field of Object.keys(fieldTypes)) {
            if (typeof fieldTypes[field] === "object") {
                assertObject(fieldTypes[field] as ObjectDefinition<unknown>, {
                    [`${key}["${field}"]`]: value[field] as {
                        [key: string]: unknown;
                    },
                });
            } else if (typeof fieldTypes[field] === "string") {
                assertType(String(fieldTypes[field]), {
                    [`${key}["${field}"]`]: value[field],
                });
            } else {
                throw new Error(
                    `Invalid object type definition ${typeof fieldTypes[
                        field
                    ]}`,
                );
            }
        }
    }
    return true;
};
