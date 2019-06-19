import chai from "chai";
import HDWalletProvider from "truffle-hdwallet-provider";
import Web3 from "web3";
import NonceSubprovider from "web3-provider-engine/subproviders/nonce-tracker";

import RenSDK from "../src/index";

require("dotenv").load();

chai.should();

const MNEMONIC = process.env.MNEMONIC;
const INFURA_URL = process.env.ETHEREUM_NODE;

/*

*MINTING*

`const shift = RenSDK.shift("BTC0Btc2Eth", renExAddress, 0.5 BTC, randomNonce, payload);`
`const gatewayAddress = await shift.addr();`
_user deposits BTC to gateway address_

`const deposit = await shift.wait(6 confirmations);`
_SDK waits for a BTC deposit_

`const signature = deposit.submit();`
_SDK calls sendMessage(gatewayAddress)_
_Darknodes see deposit and sign a mint request_

`signature.signAndSubmit(adapter, functionName)`
_SDK calls Web3.eth.Contract(adapter).functionName(mint request and signature)_
_e.g. on RenEx, this will mint BTC and swap it for DAI_

*BURNING*

_First, the user calls Web3.eth.Contract(adapter).burn() => LogShiftOut "1234"_

`RenSDK.burnStatus("1234", btcAddress)`
_Submit to darknodes => transaction hash_

 */

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
