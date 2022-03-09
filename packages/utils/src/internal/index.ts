import * as asset from "./assert";
import * as common from "./common";
import * as hashes from "./hashes";
import * as network from "./network";

export const utils = {
    ...common,
    ...asset,
    ...hashes,
    ...network,
};
