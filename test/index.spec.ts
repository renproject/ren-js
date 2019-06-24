import axios from "axios";
import bitcore, { Address, Networks, Script, Transaction } from "bitcore-lib";
import chai from "chai";
import HDWalletProvider from "truffle-hdwallet-provider";
import Web3 from "web3";

import { ShiftActions } from "../src/assets";
import { strip0x } from "../src/blockchain/common";
import RenSDK, { getBTCTestnetUTXOs } from "../src/index";
import { Arg, Payload } from "../src/utils";

require("dotenv").config();

chai.should();

const MNEMONIC = process.env.MNEMONIC;
// tslint:disable-next-line:mocha-no-side-effect-code
const INFURA_URL = `https://kovan.infura.io/v3/${process.env.INFURA_KEY}`;
const MERCURY_URL = `https://ren-mercury.herokuapp.com/btc-testnet3`;
const BITCOIN_KEY = process.env.TESTNET_BITCOIN_KEY;

/*

*MINTING*

`const shift = RenSDK.shift("BTC0Btc2Eth", renExAddress, 0.5 BTC (in sats), randomNonce, payload);`
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

_First, the front-end/user calls Web3.eth.Contract(adapter).burn() => LogShiftOut "1234"_

`RenSDK.burnStatus("1234", btcAddress)`
_Submit to darknodes => transaction hash_

 */

describe("SDK methods", function () {
    this.timeout(0);

    // tslint:disable-next-line:no-any
    let provider: any;
    let web3: Web3;
    let sdk: RenSDK;
    let accounts: string[];

    before(async () => {
        provider = new HDWalletProvider(MNEMONIC, INFURA_URL, 0, 10);
        web3 = new Web3(provider);
        sdk = new RenSDK();
        accounts = await web3.eth.getAccounts();
    });

    it("should be able to mint and burn btc", async () => {
        const contractAddress = "0dF3510a4128c0cA11518465f670dB970E9302B7";
        const arg: Arg = {
            type: "bytes20",
            value: accounts[0],
        };
        const amount = 11000;
        const payload: Payload = [arg];
        const shift = sdk.shift(ShiftActions.BTC.Btc2Eth, contractAddress, amount, "ded38c324d6e9b5148dd859b17e91061910a1baa75516447f2c133e9aa9e3a48", payload);
        const gatewayAddress = shift.addr();

        // Deposit BTC to gateway address.
        const privateKey = new bitcore.PrivateKey(BITCOIN_KEY, Networks.testnet);
        const fromAddress = privateKey.toAddress().toString();
        const utxos = await getBTCTestnetUTXOs(fromAddress, 10, 0);
        const bitcoreUTXOs: Transaction.UnspentOutput[] = [];
        let utxoAmount = 0;
        for (const utxo of utxos) {
            if (utxoAmount >= amount) {
                break;
            }
            const bitcoreUTXO = new Transaction.UnspentOutput({
                txId: utxo.txHash,
                outputIndex: utxo.vout,
                address: new Address(fromAddress),
                script: new Script(utxo.scriptPubKey),
                satoshis: utxo.amount,
            });
            bitcoreUTXOs.push(bitcoreUTXO);
            utxoAmount += utxo.amount;
        }

        const transaction = new bitcore.Transaction().from(bitcoreUTXOs).to(gatewayAddress, amount).sign(privateKey);

        console.log(`Transferring ${amount / 10 ** 8} BTC to ${gatewayAddress} (from ${fromAddress})`);
        try {
            await axios.post(`${MERCURY_URL}/tx`, { stx: transaction.toString() });
        } catch (error) {
            console.log("Unable to submit to Mercury. Trying chain.so...");
            try {
                await axios.post("https://chain.so/api/v2/send_tx/BTCTEST", { tx_hex: transaction.toString() });
            } catch (chainError) {
                console.log(`Please check ${fromAddress}'s balance`);
                console.error(`chain.so returned error ${chainError.message}`);
                throw error;
            }
        }

        // Wait for deposit to be received and submit to Lightnode + Ethereum.
        console.log(`Waiting for ${0} confirmations...`);
        const deposit = await shift.wait(0);
        console.log(`Submitting deposit!`);
        console.log(deposit);
        const signature = await deposit.submit();
        console.log(`Submitting signature!`);
        console.log(signature);
        await signature.signAndSubmit(web3, "shiftIn");
    });
});
