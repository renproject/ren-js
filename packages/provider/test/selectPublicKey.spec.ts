/* eslint-disable @typescript-eslint/no-var-requires */

import chai from "chai";

import { Ox } from "@renproject/utils";

import { RenVMProvider } from "../src";

chai.should();

describe("RenVMProvider v2", () => {
    it("selectShard", async () => {
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
        Ox((await renVMProvider.selectShard("BTC")).gPubKey).should.equal("");
    });
});
