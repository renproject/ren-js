// export * as v1 caused issues with some installations.

import * as v1import from "./v1/index";
import * as v2import from "./v2/index";
import * as v3import from "./v3/index";

export * from "./combinedProvider";

export const v1 = v1import;
export const v2 = v2import;
export const v3 = v3import;

export { AbstractRenVMProvider } from "./abstract";
