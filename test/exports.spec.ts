import chai from "chai";

import RenSDK, { Chain, Network, Tokens } from "../src/index";

require("dotenv").config();

chai.should();

describe("Static exports", () => {
    it("On uninitialized class", async () => {
        RenSDK.Networks.should.equal(Network);
        RenSDK.Tokens.should.equal(Tokens);
        RenSDK.Chains.should.equal(Chain);
    });

    it("On initialized class", async () => {
        const renSDK = new RenSDK("testnet");
        renSDK.Networks.should.equal(Network);
        renSDK.Tokens.should.equal(Tokens);
        renSDK.Chains.should.equal(Chain);
    });
});
