import chai from "chai";

import RenVM, { Chain, Network, Tokens } from "../src/index";
import {
    NetworkChaosnet, NetworkDevnet, NetworkMainnet, NetworkTestnet,
} from "../src/types/networks";

chai.should();

describe("RenVM initialization and exports", () => {
    it("should be able to pass in different networks", async () => {
        (() => new RenVM()).should.throw(/Mainnet is not supported yet/);
        (() => new RenVM("mainnet")).should.throw(/Mainnet is not supported yet/);
        new RenVM("chaosnet")
            .should.be.an.instanceOf(RenVM);
        new RenVM("testnet")
            .should.be.an.instanceOf(RenVM);
        new RenVM("devnet")
            .should.be.an.instanceOf(RenVM);
        new RenVM(NetworkMainnet)
            .should.be.an.instanceOf(RenVM);
        new RenVM(NetworkChaosnet)
            .should.be.an.instanceOf(RenVM);
        new RenVM(NetworkTestnet)
            .should.be.an.instanceOf(RenVM);
        new RenVM(NetworkDevnet)
            .should.be.an.instanceOf(RenVM);
        (() => new RenVM("fake-network")).should.throw(/Unsupported network "fake-network"/);
    });

    it("On uninitialized class", async () => {
        RenVM.Networks.should.equal(Network);
        RenVM.Tokens.should.equal(Tokens);
        RenVM.Chains.should.equal(Chain);
    });

    it("On initialized class", async () => {
        const renVM = new RenVM("testnet");
        renVM.Networks.should.equal(Network);
        renVM.Tokens.should.equal(Tokens);
        renVM.Chains.should.equal(Chain);
    });

    // it("Exposes BTC.addressToHex", () => {
    //     RenVM.Tokens.BTC.addressToHex("2MsjneiPJPfDRcbE9bCRs1RDQ2w7Bgh3nkC")
    //         .should.equal("0xc40566e98bcfb81185df27a5fdc60cd4c206415b1f08630ccd");
    // });
});
