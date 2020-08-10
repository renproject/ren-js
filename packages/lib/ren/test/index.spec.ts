import {
    renChaosnet,
    renDevnet,
    renMainnet,
    renTestnet,
} from "@renproject/contracts";
import { Chain, RenNetwork, Tokens } from "@renproject/interfaces";
import chai from "chai";
import { expect } from "earljs";
import Web3 from "web3";

import RenJS from "../src/index";

chai.should();

require("dotenv").config();

describe("RenJS initialization and exports", () => {
    it("should be able to pass in different networks", async () => {
        new RenJS().should.be.an.instanceOf(RenJS);
        new RenJS().network.name.should.equal("mainnet");
        new RenJS("mainnet").should.be.an.instanceOf(RenJS);
        new RenJS("chaosnet").should.be.an.instanceOf(RenJS);
        new RenJS("testnet").should.be.an.instanceOf(RenJS);
        new RenJS("devnet").should.be.an.instanceOf(RenJS);
        new RenJS(renMainnet).should.be.an.instanceOf(RenJS);
        new RenJS(renChaosnet).should.be.an.instanceOf(RenJS);
        new RenJS(renTestnet).should.be.an.instanceOf(RenJS);
        new RenJS(renDevnet).should.be.an.instanceOf(RenJS);
        (() => new RenJS("fake-network")).should.throw(
            /Unsupported network "fake-network"/,
        );
    });

    it("On uninitialized class", async () => {
        expect(RenJS.Networks).toEqual(RenNetwork);
        expect(RenJS.Tokens).toEqual(Tokens);
        expect(RenJS.Chains).toEqual(Chain);
    });

    // it("Exposes BTC.addressToHex", () => {
    //     RenJS.Tokens.BTC.addressToHex("2MsjneiPJPfDRcbE9bCRs1RDQ2w7Bgh3nkC")
    //         .should.equal("0xc40566e98bcfb81185df27a5fdc60cd4c206415b1f08630ccd");
    // });

    it("cancel wait", async () => {
        const renJS = new RenJS("testnet");
        const amount = 0.001; // testnet BTC

        const lockAndMint = renJS.lockAndMint({
            // Send BTC from the Bitcoin blockchain to the Ethereum blockchain.
            sendToken: RenJS.Tokens.BTC.Btc2Eth,

            // Amount of BTC we are sending (in Satoshis)
            suggestedAmount: Math.floor(amount * 10 ** 8), // Convert to Satoshis

            contractCalls: [
                {
                    // The contract we want to interact with
                    sendTo: "0xb2731C04610C10f2eB6A26ad14E607d44309FC10",

                    // The name of the function we want to call
                    contractFn: "deposit",

                    // Arguments expected for calling `deposit`
                    contractParams: [],
                },
            ],
        });

        // tslint:disable-next-line: await-promise
        await expect(
            new Promise((_, reject) => {
                const wait = lockAndMint.wait(0);

                wait._cancel();

                wait.then((result) => {
                    reject(
                        `Unexpected resolution from 'wait' with result ${result}`,
                    );
                }).catch(reject);
            }),
        ).toBeRejected("Wait cancelled.");
    });

    it("cancel submit", async () => {
        const renJS = new RenJS("testnet");

        const burnAndRelease = await renJS
            .burnAndRelease({
                // Send BTC from the Ethereum blockchain to the Bitcoin blockchain.
                sendToken: RenJS.Tokens.BTC.Eth2Btc,

                burnReference: 0x483,
            })
            .readFromEthereum();

        // tslint:disable-next-line: await-promise
        await expect(
            new Promise((_, reject) => {
                const wait = burnAndRelease.submit();

                wait._cancel();

                wait.catch(reject);
            }),
        ).toBeRejected("waitForTX cancelled");
    });

    for (const network of ["devnet", "testnet", "chaosnet"]) {
        it(`get token and gateway addresses for ${network}`, async () => {
            const renJS = new RenJS(network);

            const infuraURL = `${renJS.network.infura}/v3/${process.env.INFURA_KEY}`;
            const web3 = new Web3(infuraURL);

            for (const asset of ["BTC", "ZEC", "BCH"] as const) {
                // Without const, defaults to string[]
                expect(await renJS.getTokenAddress(web3, asset)).toEqual(
                    renJS.network.addresses.gateways[`Ren${asset}`]._address,
                );

                expect(await renJS.getGatewayAddress(web3, asset)).toEqual(
                    renJS.network.addresses.gateways[`${asset}Gateway`]
                        ._address,
                );
            }
        });
    }
});
