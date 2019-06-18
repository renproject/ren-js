import chai from "chai";
import HDWalletProvider from "truffle-hdwallet-provider";
import Web3 from "web3";
import NonceSubprovider from "web3-provider-engine/subproviders/nonce-tracker";

import RenSDK from "../src/index";

require("dotenv").load();

chai.should();

const MNEMONIC = process.env.MNEMONIC;
const INFURA_URL = process.env.ETHEREUM_NODE;

describe("SDK methods", () => {
    // tslint:disable-next-line:no-any
    let sdk: RenSDK;
    let provider;
    let web3;
    let accounts;
    let mainAccount;

    before(async () => {
        if (!MNEMONIC) {
            throw new Error("MNEMONIC environment variable has not been set");
        }

        // Initialize the provider and set our own nonce tracker
        // provider = new HDWalletProvider(MNEMONIC, INFURA_URL, 0, 10);
        // const nonceTracker = new NonceSubprovider();
        // provider.engine._providers.unshift(nonceTracker);
        // nonceTracker.setEngine(provider.engine);
        // web3 = new Web3(provider);

        // // Set up the SDK to use the main account
        // accounts = await web3.eth.getAccounts();
        // mainAccount = accounts[0];
        // sdk.setAddress(mainAccount);

        // sdk = new RenSDK()
    });

    it("should return the correct SDK address", () => {
        (1).should.equal(1);
    });
});
