import { RenNetwork } from "@renproject/ren-js-common";
import chai from "chai";
import Web3 from "web3";

import RenJS, { Chain } from "../src/index";
import { Tokens } from "../src/types/assets";
import {
    NetworkChaosnet, NetworkDevnet, NetworkMainnet, NetworkTestnet,
} from "../src/types/networks";

chai.should();

require("dotenv").config();

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
        RenJS.Networks.should.equal(RenNetwork);
        RenJS.Tokens.should.equal(Tokens);
        RenJS.Chains.should.equal(Chain);
    });

    // it("Exposes BTC.addressToHex", () => {
    //     RenJS.Tokens.BTC.addressToHex("2MsjneiPJPfDRcbE9bCRs1RDQ2w7Bgh3nkC")
    //         .should.equal("0xc40566e98bcfb81185df27a5fdc60cd4c206415b1f08630ccd");
    // });

    it("cancel waitForDeposit", async () => {
        const renJS = new RenJS("testnet");
        const amount = 0.001; // testnet BTC

        const shiftIn = renJS.shiftIn({
            // Send BTC from the Bitcoin blockchain to the Ethereum blockchain.
            sendToken: RenJS.Tokens.BTC.Btc2Eth,

            // Amount of BTC we are sending (in Satoshis)
            requiredAmount: Math.floor(amount * (10 ** 8)), // Convert to Satoshis

            // The contract we want to interact with
            sendTo: "0xb2731C04610C10f2eB6A26ad14E607d44309FC10",

            // The name of the function we want to call
            contractFn: "deposit",

            // Arguments expected for calling `deposit`
            contractParams: [],
        });

        // tslint:disable-next-line: await-promise
        await new Promise((_, reject) => {

            const wait = shiftIn.waitForDeposit(0);

            wait._cancel();

            wait.then((result) => { reject(`Unexpected resolution from 'waitForDeposit' with result ${result}`); })
                .catch(reject);

        }).should.be.rejectedWith(/waitForDeposit cancelled/);
    });

    it("cancel submitToRenVM", async () => {
        const renJS = new RenJS("testnet");

        const shiftOut = await renJS.shiftOut({
            // Send BTC from the Ethereum blockchain to the Bitcoin blockchain.
            sendToken: RenJS.Tokens.BTC.Eth2Btc,

            burnReference: 0,
        }).readFromEthereum();

        // tslint:disable-next-line: await-promise
        await new Promise((_, reject) => {

            const wait = shiftOut.submitToRenVM();

            wait._cancel();

            wait.catch(reject);

        }).should.be.rejectedWith(/waitForTX cancelled/);
    });

    for (const network of ["devnet", "testnet", "chaosnet"]) {
        it(`get token and shifter addresses for ${network}`, async () => {
            const renJS = new RenJS(network);

            const infuraURL = `${renJS.network.contracts.infura}/v3/${process.env.INFURA_KEY}`;
            const web3 = new Web3(infuraURL);

            for (const asset of ["BTC", "ZEC", "BCH"] as const) { // Without const, defaults to string[]
                (await renJS.getTokenAddress(web3, asset))
                    .should.equal(renJS.network.contracts.addresses.shifter[`z${asset}`]._address);

                (await renJS.getShifterAddress(web3, asset))
                    .should.equal(renJS.network.contracts.addresses.shifter[`${asset}Shifter`]._address);
            }
        });
    }
});
