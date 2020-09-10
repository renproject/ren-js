import { AbiCoder } from "web3-eth-abi";

import { fromHex, strip0x } from "./common";

export const rawEncode = (
    types: Array<string | {}>,
    // tslint:disable-next-line:no-any
    parameters: any[]
): Buffer =>
    fromHex(strip0x(new AbiCoder().encodeParameters(types, parameters)));
