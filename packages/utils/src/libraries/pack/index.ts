import { isPackListType, isPackStructType } from "./common";
import * as marshal from "./marshal";
import * as unmarshal from "./unmarshal";

export * from "./types";

/**
 * `pack` implements marshalling and marshalling for the pack serializing
 * standard. See github.com/renproject/pack
 */
export const pack = {
    isPackStructType,
    isPackListType,
    marshal,
    unmarshal,
};
