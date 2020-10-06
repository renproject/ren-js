import { AbiCoder } from "web3-eth-abi";

import { fromHex } from "./common";

export const rawEncode = (
    types: Array<string | {}>,
    // tslint:disable-next-line:no-any
    parameters: any[]
): Buffer => fromHex(new AbiCoder().encodeParameters(types, parameters));
