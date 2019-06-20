import chai from "chai";
import Web3 from "web3";
import FakeProvider from "web3-fake-provider";

import { ShiftActions } from "../src/assets";
import RenSDK from "../src/index";
import { Param, Payload } from "../src/utils";

require("dotenv").config();

chai.should();

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
    let web3;
    // let accounts;
    // let mainAccount;

    before(async () => {
        web3 = new Web3(new FakeProvider());

        // // Set up the SDK to use the main account
        // accounts = await web3.eth.getAccounts();
        // mainAccount = accounts[0];
        // sdk.setAddress(mainAccount);

        sdk = new RenSDK();
    });

    it("should be able to mint btc", async () => {
        const param: Param = {
            type: "bytes20",
            value: "1234567890123456789012345678901234567890",
        };
        const payload: Payload = [param];

        const shift = sdk.shift(ShiftActions.BTC.Btc2Eth, "797522Fb74d42bB9fbF6b76dEa24D01A538d5D66", 22500, "ded38c324d6e9b5148dd859b17e91061910a1baa75516447f2c133e9aa9e3a48", payload);

        const gatewayAddress = await shift.addr();
        // TODO: Deposit BTC to gateway address

        const deposit = await shift.wait(6);
        const signature = await deposit.submit();
        await signature.signAndSubmit(web3, "");
    });
});
