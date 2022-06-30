import { RPCMethod } from "@renproject/provider/methods";
import { expect } from "chai";

import { MockChain, MockProvider } from "../src";

describe("@renproject/mock-provider", () => {
    it("should export MockProvider and MockChain correctly", async () => {
        expect(MockProvider).not.to.equal(undefined);
        expect(MockChain).not.to.equal(undefined);
    });

    it("can provide a gPubKey", async () => {
        const gPubKey = "Aw3WX32ykguyKZEuP0IT3RUOX5csm3PpvnFNhEVhrDVc";
        const provider = new MockProvider({
            gPubKey,
        });
        const blockState = await provider.sendMessage(
            RPCMethod.QueryBlockState,
            {
                contract: "BTC",
            },
        );
        expect(blockState.state.v["BTC"].shards[0].pubKey).to.equal(gPubKey);
    });
});
