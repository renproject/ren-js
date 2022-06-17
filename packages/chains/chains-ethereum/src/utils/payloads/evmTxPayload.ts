import { ChainTransaction } from "@renproject/utils";
import { PopulatedTransaction } from "ethers";

import { EVMPayloadInterface, PayloadHandler } from "./evmParams";

export type EVMTxPayload = EVMPayloadInterface<
    "transaction",
    {
        tx: ChainTransaction;
    }
>;

export const txPayloadHandler: PayloadHandler<EVMTxPayload> = {
    export: (): PopulatedTransaction => {
        throw new Error(`Unable to export transaction payload.`);
    },
};
