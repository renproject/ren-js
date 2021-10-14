import chai from "chai";

import RenJS from "@renproject/ren";

chai.should();

describe("RenJS initialization and exports", () => {
    it("should be able to pass in different networks", async () => {
        try {
            new RenJS().should.be.an.instanceOf(RenJS);
            (await new RenJS().renVM.getNetwork("BTC0Btc2Eth")).should.equal(
                "mainnet",
            );
            new RenJS("mainnet").should.be.an.instanceOf(RenJS);
            new RenJS("testnet").should.be.an.instanceOf(RenJS);

            // @ts-expect-error it should reject the parameter `"fake-network"`
            (() => new RenJS("fake-network")).should.throw(
                /Invalid network or provider URL: "fake-network"/,
            );
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } catch (error: any) {
            console.error(error);
            throw error;
        }
    });
});
