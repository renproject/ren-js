/* eslint-disable @typescript-eslint/no-var-requires */

import chai from "chai";

import { hash160, Ox } from "@renproject/utils";

import { RenVMProvider } from "../src";

chai.should();

describe("RenVMProvider v2", () => {
    it("selectPublicKey", async () => {
        const renVMProvider = new RenVMProvider("testnet", {
            sendMessage: (method) => {
                switch (method) {
                    case "ren_queryState":
                        return require("./mockResponses/ren_queryState.json")
                            .result;
                    case "ren_queryBlockState":
                        return require("./mockResponses/ren_queryBlockState.json")
                            .result;
                    default:
                        return {};
                }
            },
        } as any); // eslint-disable-line @typescript-eslint/no-explicit-any
        Ox(hash160(await renVMProvider.selectPublicKey("BTC"))).should.equal(
            "0x5faa9576e45acbc9662b6abf323229b748a9495d",
        );
    });
});
