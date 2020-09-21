import chai from "chai";
import RenJS from "@renproject/ren";

chai.should();

describe("RenJS networks", () => {
    it("On uninitialized class", async () => {
        for (const network of Object.keys(RenJS.Networks)) {
            (typeof RenJS.Networks[network]).should.equal("string");
            // `RenJS.Networks.Mainnet` should equal `"mainnet"`
            RenJS.Networks[network].should.equal(network.toLowerCase());
        }
    });
});
