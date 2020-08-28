import { AbiCoder } from "web3-eth-abi";

import { strip0x } from "./common";

// tslint:disable-next-line:no-any
export const rawEncode = (
    types: Array<string | {}>,
    parameters: any[]
): Buffer =>
    Buffer.from(
        strip0x(new AbiCoder().encodeParameters(types, parameters)),
        "hex"
    );
