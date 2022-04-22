import * as asset from "./assert";
import * as common from "./common";
import * as extractError from "./extractError";
import * as hashes from "./hashes";
import * as network from "./network";
import * as sleep from "./sleep";

export const utils = {
    ...common,
    ...asset,
    ...hashes,
    ...network,
    ...extractError,
    ...sleep,
};
