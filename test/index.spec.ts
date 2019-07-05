import chai from "chai";

import RenSDK, { Chain, Network, Tokens } from "../src/index";
import { NetworkDevnet, NetworkMainnet, NetworkTestnet } from "../src/types/networks";

require("dotenv").config();

chai.should();

describe("RenSDK initialization and exports", () => {
    it("should be able to pass in different networks", async () => {
        new RenSDK()
            .should.be.an.instanceOf(RenSDK);
        new RenSDK("mainnet")
            .should.be.an.instanceOf(RenSDK);
        new RenSDK("testnet")
            .should.be.an.instanceOf(RenSDK);
        new RenSDK("devnet")
            .should.be.an.instanceOf(RenSDK);
        new RenSDK(NetworkMainnet)
            .should.be.an.instanceOf(RenSDK);
        new RenSDK(NetworkTestnet)
            .should.be.an.instanceOf(RenSDK);
        new RenSDK(NetworkDevnet)
            .should.be.an.instanceOf(RenSDK);
        (() => new RenSDK("fake-network")).should.throw(/Unsupported network "fake-network"/);
    });

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

    it("Exposes BTC.addressToHex", () => {
        RenSDK.Tokens.BTC.addressToHex("2MsjneiPJPfDRcbE9bCRs1RDQ2w7Bgh3nkC")
            .should.equal("0xc40566e98bcfb81185df27a5fdc60cd4c206415b1f08630ccd");
    });
});
