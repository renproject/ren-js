import { PopulatedTransaction } from "ethers";

import { EVMPayloadInterface, PayloadHandler } from "./evmParams";

export type EVMNoncePayload = EVMPayloadInterface<
    "nonce",
    {
        nonce: string | number;
    }
>;

export const noncePayloadHandler: PayloadHandler<EVMNoncePayload> = {
    export: (): PopulatedTransaction => {
        throw new Error(`Unable to export nonce payload.`);
    },
};
