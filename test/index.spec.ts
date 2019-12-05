import chai from "chai";

import RenJS from "../src/index";
import { Chain, Tokens } from "../src/types/assets";
import {
    Network, NetworkChaosnet, NetworkDevnet, NetworkMainnet, NetworkTestnet,
} from "../src/types/networks";

chai.should();

describe("RenJS initialization and exports", () => {
    it("should be able to pass in different networks", async () => {
        (() => new RenJS()).should.throw(/Mainnet is not supported yet/);
        (() => new RenJS("mainnet")).should.throw(/Mainnet is not supported yet/);
        new RenJS("chaosnet")
            .should.be.an.instanceOf(RenJS);
        new RenJS("testnet")
            .should.be.an.instanceOf(RenJS);
        new RenJS("devnet")
            .should.be.an.instanceOf(RenJS);
        new RenJS(NetworkMainnet)
            .should.be.an.instanceOf(RenJS);
        new RenJS(NetworkChaosnet)
            .should.be.an.instanceOf(RenJS);
        new RenJS(NetworkTestnet)
            .should.be.an.instanceOf(RenJS);
        new RenJS(NetworkDevnet)
            .should.be.an.instanceOf(RenJS);
        (() => new RenJS("fake-network")).should.throw(/Unsupported network "fake-network"/);
    });

    it("On uninitialized class", async () => {
        RenJS.Networks.should.equal(Network);
        RenJS.Tokens.should.equal(Tokens);
        RenJS.Chains.should.equal(Chain);
    });

    it("On initialized class", async () => {
        const renJS = new RenJS("testnet");
        renJS.Networks.should.equal(Network);
        renJS.Tokens.should.equal(Tokens);
        renJS.Chains.should.equal(Chain);
    });

    // it("Exposes BTC.addressToHex", () => {
    //     RenJS.Tokens.BTC.addressToHex("2MsjneiPJPfDRcbE9bCRs1RDQ2w7Bgh3nkC")
    //         .should.equal("0xc40566e98bcfb81185df27a5fdc60cd4c206415b1f08630ccd");
    // });
});
