import axios from "axios";
import BigNumber from "bignumber.js";
import bitcore, { Address, crypto, Networks, Script, Transaction } from "bitcore-lib";
import chai from "chai";
import HDWalletProvider from "truffle-hdwallet-provider";
import Web3 from "web3";
import { AbiItem } from "web3-utils";

import { ShiftActions } from "../src/assets";
import { Ox, strip0x } from "../src/blockchain/common";
import RenSDK, { getBTCTestnetUTXOs } from "../src/index";
import { Arg, Payload, ZBTC_ADDRESS } from "../src/utils";

require("dotenv").config();

chai.should();

// tslint:disable:no-unused-expression

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

// The minimum ABI to get ERC20 Token balance.
const minABI: AbiItem[] = [
    {
        constant: true,
        inputs: [
            {
                name: "account",
                type: "address"
            }
        ],
        name: "balanceOf",
        outputs: [
            {
                name: "",
                type: "uint256"
            }
        ],
        payable: false,
        stateMutability: "view",
        type: "function"
    }
];

describe("SDK methods", function () {
    this.timeout(0);

    let provider: HDWalletProvider;
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
        const adapterContract = "f72Bb079564C1b7b6EC4033cF3f6A44cE88E1c0c";
        const arg: Arg = {
            type: "address",
            value: accounts[0],
        };
        const amount = 11000;
        const payload: Payload = [arg];
        const nonce = Ox(crypto.Random.getRandomBuffer(32));
        const shift = sdk.shift(ShiftActions.BTC.Btc2Eth, adapterContract, amount, nonce, payload);
        const gatewayAddress = shift.addr();

        // Check initial zBTC balance.
        const contract = new web3.eth.Contract(minABI, strip0x(ZBTC_ADDRESS));
        let initialBalance: BigNumber;
        try {
            await contract.methods.balanceOf(accounts[0]).call({}, (error, balance) => {
                initialBalance = balance;
            });
        } catch (error) {
            console.error("Cannot check balance");
            throw error;
        }

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
        const confirmations = 0;
        console.log(`Waiting for ${confirmations} confirmations...`);
        const deposit = await shift.wait(confirmations);
        console.log(`Submitting deposit!`);
        console.log(deposit);
        const signature = await deposit.submit();
        console.log(`Submitting signature!`);
        console.log(signature);
        const result = await signature.signAndSubmit(web3, "shiftIn");
        console.log(result);

        // Check final zBTC balance.
        let finalBalance: BigNumber;
        try {
            await contract.methods.balanceOf(accounts[0]).call({}, (error, balance) => {
                finalBalance = balance;
            });
        } catch (error) {
            console.error("Cannot check balance");
            throw error;
        }

        chai.expect(finalBalance.minus(initialBalance)).to.equal(new BigNumber(amount)); // TODO: Subtract fees
    });
});
