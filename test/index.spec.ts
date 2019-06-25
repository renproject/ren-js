import axios from "axios";
import BigNumber from "bignumber.js";
import bitcore, { Address, crypto, Networks, Script, Transaction } from "bitcore-lib";
import chai from "chai";
import chaiBigNumber from "chai-bignumber";
import { BN } from "ethereumjs-util";
import HDWalletProvider from "truffle-hdwallet-provider";
import Web3 from "web3";
import { Contract } from "web3-eth-contract";
import { AbiItem } from "web3-utils";

import { ShiftActions } from "../src/assets";
import { Ox, strip0x } from "../src/blockchain/common";
import RenSDK, { getBTCTestnetUTXOs } from "../src/index";
import { NETWORK, zBTC } from "../src/networks";
import { Arg, Payload } from "../src/utils";

require("dotenv").config();

chai.use((chaiBigNumber)(BigNumber));
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

    // tslint:disable-next-line:no-any
    const checkzBTCBalance = async (contract: Contract, address: string): Promise<any> => {
        let balance: BN;

        try {
            balance = new BN((await contract.methods.balanceOf(accounts[0]).call()).toString());
        } catch (error) {
            console.error("Cannot check balance");
            throw error;
        }

        return balance;
    };

    // tslint:disable-next-line:no-any
    const checkBTCBalance = async (contract: Contract, address: string): Promise<any> => {
        // TODO:
        return new BN(0);
    };

    const mintTest = async (amount: number, ethAddress: string, btcAddress: string, btcPrivateKey: bitcore.PrivateKey): Promise<void> => {
        const adapterContract = "0xAfec5fCAc09810afbe33a45A3797C29b33DA0112";
        const arg: Arg = {
            name: "_address",
            type: "address",
            value: ethAddress,
        };
        const payload: Payload = [arg];
        const nonce = Ox(crypto.Random.getRandomBuffer(32));
        const shift = sdk.shift(ShiftActions.BTC.Btc2Eth, adapterContract, amount, nonce, payload);
        const gatewayAddress = shift.addr();

        // Deposit BTC to gateway address.
        const utxos = await getBTCTestnetUTXOs(btcAddress, 10, 0);
        const bitcoreUTXOs: Transaction.UnspentOutput[] = [];
        let utxoAmount = 0;
        // for (const utxo of utxos.reverse()) {
        for (const utxo of utxos) {
            if (utxoAmount >= amount) {
                break;
            }
            const bitcoreUTXO = new Transaction.UnspentOutput({
                txId: utxo.txHash,
                outputIndex: utxo.vout,
                address: new Address(btcAddress),
                script: new Script(utxo.scriptPubKey),
                satoshis: utxo.amount,
            });
            bitcoreUTXOs.push(bitcoreUTXO);
            utxoAmount += utxo.amount;
        }

        const transaction = new bitcore.Transaction().from(bitcoreUTXOs).to(gatewayAddress, amount).sign(btcPrivateKey);

        console.log(`Transferring ${amount / 10 ** 8} BTC to ${gatewayAddress} (from ${btcAddress})`);
        try {
            await axios.post(`${MERCURY_URL}/tx`, { stx: transaction.toString() });
        } catch (error) {
            console.log(`Unable to submit to Mercury (${error}). Trying chain.so...`);
            try {
                console.log(transaction.toString());
                await axios.post("https://chain.so/api/v2/send_tx/BTCTEST", { tx_hex: transaction.toString() });
            } catch (chainError) {
                console.error(`chain.so returned error ${chainError.message}`);
                console.log(`\n\n\nPlease check ${btcAddress}'s balance!\n`);
                throw error;
            }
        }

        // Wait for deposit to be received and submit to Lightnode + Ethereum.
        const confirmations = 0;
        console.log(`Waiting for ${confirmations} confirmations...`);
        const deposit = await shift.wait(confirmations);
        console.log(`Submitting deposit!`);
        const signature = await deposit.submit();
        console.log(`Submitting signature!`);
        const accounts = await web3.eth.getAccounts();
        const result = await signature.signAndSubmit(web3, "shiftIn", accounts[0]);
        console.log(result);
    };

    const burnTest = async (amount: number, btcAddress: string) => {
        await sdk.burn(ShiftActions.BTC.Eth2Btc, btcAddress, amount);
    };

    const removeFee = (value: BN, bips: number): BN => value.sub(value.mul(new BN(bips)).div(new BN(10000)));

    it("should be able to mint and burn btc", async () => {
        const amount = 21000;
        const vmFee = 10000;
        const ethAddress = accounts[0];
        const btcPrivateKey = new bitcore.PrivateKey(BITCOIN_KEY, Networks.testnet);
        const btcAddress = btcPrivateKey.toAddress().toString();
        const contract = new web3.eth.Contract(minABI, strip0x(zBTC[NETWORK]));

        // Test minting.
        const initialzBTCBalance = await checkzBTCBalance(contract, accounts[0]);
        await mintTest(amount, ethAddress, btcAddress, btcPrivateKey);
        const finalzBTCBalance = await checkzBTCBalance(contract, accounts[0]);

        // Check the minted amount is at least (amount - renVM fee - 10 bips) and at most (amount - renVM fee).
        finalzBTCBalance.sub(initialzBTCBalance).should.bignumber.least(removeFee(new BN(amount).sub(new BN(vmFee)), 10));
        finalzBTCBalance.sub(initialzBTCBalance).should.bignumber.most(new BN(amount).sub(new BN(vmFee)));

        // Test burning.
        /* const initialBTCBalance = await checkBTCBalance(contract, accounts[0]);
        await burnTest(removeFee(amount, 10), btcAddress);
        const finalBTCBalance = await checkBTCBalance(contract, accounts[0]);

        finalBTCBalance.sub(initialBTCBalance).should.bignumber.equal(removeFee(amount, 10)); */
    });
});
