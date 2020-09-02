import { AbiCoder } from "web3-eth-abi";

import { strip0x } from "./common";

export const rawEncode = (
    types: Array<string | {}>,
    // tslint:disable-next-line:no-any
    parameters: any[]
): Buffer =>
    Buffer.from(
        strip0x(new AbiCoder().encodeParameters(types, parameters)),
        "hex"
    );
