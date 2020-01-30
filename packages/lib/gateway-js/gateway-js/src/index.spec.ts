import test, { ExecutionContext } from "ava";

import GatewayJS from "./index";

console.log(GatewayJS);

test((t: ExecutionContext<unknown>) => {
    t.is(true, true);
});
