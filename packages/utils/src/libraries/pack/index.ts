import * as binaryMarshal from "./binaryMarshal";
import { isPackListType, isPackStructType } from "./common";
import * as unmarshal from "./unmarshal";

export * from "./types";

/**
 * `pack` implements marshalling and marshalling for the pack serializing
 * standard. See github.com/renproject/pack
 */
export const pack = {
    isPackStructType,
    isPackListType,
    binaryMarshal,
    unmarshal,
};
