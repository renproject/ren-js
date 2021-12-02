import { PackListType, PackStructType } from "./types";

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

/**
 * Check that the passed-in value is a PackListType - i.e. an object that has
 * a single field called `list`.
 */
export const isPackListType = (type: unknown): type is PackListType =>
    typeof type === "object" && (type as PackListType).list !== undefined;
