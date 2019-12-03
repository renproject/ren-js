// tslint:disable: no-console

/// <reference types="./testutils/chai" />
/// <reference types="./testutils/declarations" />
/// <reference types="../src/types/declarations/bitcore-lib" />

import BigNumber from "bignumber.js";
import { PrivateKey as BPrivateKey } from "bitcore-lib";
import { PrivateKey as ZPrivateKey } from "bitcore-lib-zcash";
import bs58 from "bs58";
import chai from "chai";
import chaiBigNumber from "chai-bignumber";
import chalk from "chalk";
import { BN } from "ethereumjs-util";
import HDWalletProvider from "truffle-hdwallet-provider";
import Web3 from "web3";
import { Contract } from "web3-eth-contract";

import { Ox, strip0x } from "../src/blockchain/common";
import RenVM, {
    BitcoinUTXO, getBitcoinUTXOs, getZcashUTXOs, ShiftInObject, ShiftOutObject, ZcashUTXO,
} from "../src/index";
import { sleep } from "../src/lib/utils";
import { Args } from "../src/renVM/jsonRPC";
import { Token, Tokens } from "../src/types/assets";
import { NetworkDetails, stringToNetwork } from "../src/types/networks";
import { sendBTC, sendZEC } from "./testutils/btcAndZecUtils";

chai.use((chaiBigNumber)(BigNumber));
chai.should();

// A debug `sleep`. It prints a count-down to the console.
// tslint:disable-next-line: no-string-based-set-timeout
export const sleepWithCountdown = async (seconds: number) => {
    while (seconds) {
        process.stdout.write(`${seconds}\t\t\r`);
        await sleep(1000);
        seconds -= 1;
    }
    process.stdout.write("\t\t\r");
};

require("dotenv").config();

const MNEMONIC = process.env.MNEMONIC;
const NETWORK = process.env.NETWORK;
const BITCOIN_KEY = process.env.TESTNET_BITCOIN_KEY;

describe("Shifting in and shifting out", function () {
    // Disable test timeout.
    this.timeout(0);

    let provider: HDWalletProvider;
    let web3: Web3;
    let network: NetworkDetails;
    let sdk: RenVM;
    let accounts: string[];

    before(async () => {
        const infuraURL = `https://kovan.infura.io/v3/${process.env.INFURA_KEY}`;
        provider = new HDWalletProvider(MNEMONIC, infuraURL, 0, 10);
        web3 = new Web3(provider);
        accounts = await web3.eth.getAccounts();
        web3.eth.defaultAccount = accounts[0];
        network = stringToNetwork(NETWORK || "testnet");
        sdk = new RenVM(network);
    });

    const checkERC20Balance = async (contract: Contract, address: string): Promise<BN> =>
        new BN((await contract.methods.balanceOf(address).call()).toString());

    const sumUTXOs = (utxos: Array<BitcoinUTXO | ZcashUTXO>) => utxos.reduce((sum, utxo) => sum.add(new BN(utxo.value)), new BN(0));

    const mintTest = async (
        sendToken: Token,
        shifterAddress: string,
        adapterContract: string,
        amount: number,
        ethAddress: string,
        sendAsset: (gatewayAddress: string, amount: number) => Promise<void>,
        submit: (shift: ShiftInObject) => Promise<void>,
    ): Promise<void> => {
        const params: Args = [
            {
                name: "_shifter",
                type: "address",
                value: shifterAddress,
            },
            {
                name: "_address",
                type: "address",
                value: ethAddress,
            }
        ];
        const shift = sdk.shiftIn({
            sendTo: adapterContract,
            sendToken,
            sendAmount: amount,
            contractFn: "shiftIn",
            contractParams: params,
        });
        const gatewayAddress = shift.addr();

        console.log(`amount: ${amount}`);

        await sendAsset(gatewayAddress, amount);

        await submit(shift);
    };

    const submitIndividual = async (shift: ShiftInObject): Promise<void> => {
        // Wait for deposit to be received and submit to Lightnode + Ethereum.
        const confirmations = 0;
        console.log(`Waiting for ${confirmations} confirmations...`);

        const deposit = await shift.waitForDeposit(confirmations)
            .on("deposit", (depositObject) => { console.log(`${chalk.blue("[EVENT]")} Received a new deposit: ${JSON.stringify(depositObject)}`); });

        await sleepWithCountdown(5);

        console.log(`Submitting deposit!`);
        const signature = await deposit.submitToRenVM()
            .on("messageID", (messageID: string) => { console.log(`${chalk.blue("[EVENT]")} Received messageID: ${messageID}`); })
            .on("status", (status) => { process.stdout.write(`${chalk.blue("[EVENT]")} Received status: ${chalk.green(status)}\t\t\r`); });
        console.log(""); // new line

        console.log(`Submitting signature!`);
        console.log("Waiting for tx...");
        try {
            const result = await signature.submitToEthereum(provider, { gas: 1000000 })
                .on("transactionHash", (txHash: string) => { console.log(`${chalk.blue("[EVENT]")} Received txHash: ${txHash}`); });
            console.log("Done waiting for tx!");
        } catch (error) {
            console.error(error);
            throw error;
        }
    };

    const submitTogether = async (shift: ShiftInObject): Promise<void> => {
        // Wait for deposit to be received and submit to Lightnode + Ethereum.
        const confirmations = 0;
        await shift.waitAndSubmit(provider, confirmations);
    };

    const burnTest = async (
        sendToken: Token,
        erc20Contract: Contract,
        shifterAddress: string,
        adapterContract: string,
        amount: number | BN,
        ethAddress: string,
        srcAddress: string,
    ) => {
        // Approve contract to spend the shifted token.
        const approvePayload: Args = [
            {
                name: "spender",
                type: "address",
                value: adapterContract,
            },
            {
                name: "value",
                type: "uint256",
                value: Ox(amount.toString(16)),
            },
        ];
        const approveParams = [
            ...approvePayload.map(value => value.value),
        ];

        console.log("Approving contract.");
        await new Promise((resolve, reject) => erc20Contract.methods.approve(
            ...approveParams,
        ).send({ from: ethAddress, gas: 1000000 })
            .on("transactionHash", (txHash: string) => { console.log(`${chalk.blue("[EVENT]")} Received txHash: ${txHash}`); })
            .on("confirmation", resolve)
            .catch((error: Error) => {
                if (error && error.message && error.message.match(/Invalid block number/)) {
                    console.error(error);
                    return;
                }
                reject(error);
            })
        );

        // Send burn request to adapter contract.
        const payload: Args = [
            {
                name: "_shifter",
                type: "address",
                value: shifterAddress,
            },
            {
                name: "_to",
                type: "bytes",
                value: Ox(bs58.decode(srcAddress).toString("hex")),
            },
            {
                name: "_amount",
                type: "uint256",
                value: Ox(amount.toString(16)),
            },
        ];

        console.log("Reading burn from Ethereum.");

        let shiftOutObject: ShiftOutObject;
        try {
            shiftOutObject = await sdk.shiftOut({
                sendTo: adapterContract,
                contractFn: "shiftOut",
                contractParams: payload,
                txConfig: { from: ethAddress, gas: 1000000 },

                web3Provider: provider,
                sendToken,
                // txHash: result.transactionHash,
            }).readFromEthereum()
                .on("transactionHash", (txHash: string) => { console.log(`${chalk.blue("[EVENT]")} Received txHash: ${txHash}`); });
        } catch (error) {
            console.error(error);
        }

        await sleepWithCountdown(5);

        console.log("Submitting burn to RenVM.");

        await shiftOutObject.submitToRenVM()
            .on("messageID", (messageID) => { console.log(`${chalk.blue("[EVENT]")} Received messageID: ${messageID}`); })
            .on("status", (status) => { process.stdout.write(`${chalk.blue("[EVENT]")} Received status: ${chalk.green(status)}\t\t\r`); });
        console.log(""); // new line
    };

    const removeVMFee = (value: BN): BN => value.sub(new BN(10000));
    const removeGasFee = (value: BN, bips: number): BN => value.sub(value.mul(new BN(bips)).div(new BN(10000)));

    describe("minting and buning", () => {
        const caseBTC = { name: "BTC", fn: () => ({ getUTXOS: getBitcoinUTXOs, mintToken: Tokens.BTC.Btc2Eth, burnToken: Tokens.BTC.Eth2Btc, privateKey: () => new BPrivateKey(BITCOIN_KEY, network.bitcoinNetwork), shiftedToken: "zBTC", shifter: network.contracts.addresses.shifter.BTCShifter, sendAsset: sendBTC(network, BITCOIN_KEY) }) };
        const caseZEC = { name: "ZEC", fn: () => ({ getUTXOS: getZcashUTXOs, mintToken: Tokens.ZEC.Zec2Eth, burnToken: Tokens.ZEC.Eth2Zec, privateKey: () => new ZPrivateKey(BITCOIN_KEY, network.bitcoinNetwork), shiftedToken: "zZEC", shifter: network.contracts.addresses.shifter.ZECShifter, sendAsset: sendZEC(network, BITCOIN_KEY) }) };

        for (const testcaseFn of [
            { ...caseBTC, it, },
            { ...caseZEC, it, },
        ]) {
            // tslint:disable-next-line: mocha-no-side-effect-code
            testcaseFn.it(`should be able to mint and burn ${testcaseFn.name} to Ethereum`, async () => {
                const testcase = testcaseFn.fn();

                const adapterContract = "0xC99Ab5d1d0fbf99912dbf0DA1ADC69d4a3a1e9Eb";
                const amount = Math.floor(0.00015 * (10 ** 8));
                const ethAddress = accounts[0];
                const privateKey = testcase.privateKey();
                const srcAddress = privateKey.toAddress();
                const shifterRegistry = new web3.eth.Contract(network.contracts.addresses.shifter.ShifterRegistry.abi, network.contracts.addresses.shifter.ShifterRegistry.address);
                const shiftedTokenAddress = await shifterRegistry.methods.getTokenBySymbol(testcase.shiftedToken).call();
                console.log("shiftedTokenAddress", shiftedTokenAddress);
                const shifterAddress = await shifterRegistry.methods.getShifterBySymbol(testcase.shiftedToken).call();
                console.log("shifterAddress", shifterAddress);
                const erc20Contract = new web3.eth.Contract(network.contracts.addresses.erc.ERC20.abi, shiftedTokenAddress);

                // Test minting.
                console.log("Starting mint test:");
                const initialERC20Balance = await checkERC20Balance(erc20Contract, ethAddress);
                await mintTest(
                    testcase.mintToken,
                    shifterAddress,
                    adapterContract,
                    amount,
                    ethAddress,
                    testcase.sendAsset,
                    submitIndividual,
                );

                const finalERC20Balance = await checkERC20Balance(erc20Contract, ethAddress);

                // Check the minted amount is at least (amount - renVM fee - 10 bips) and at most (amount - renVM fee).
                const balance = finalERC20Balance.sub(initialERC20Balance); // BN
                balance.should.bignumber.at.least(removeVMFee(removeGasFee(new BN(amount), 10)));
                balance.should.bignumber.at.most(new BN(amount));

                // // Test burning.
                const burnValue = finalERC20Balance;
                // const burnValue = balance.toNumber();
                // amount = 0.000225 * (10 ** 8);
                // const burnValue = amount;
                console.log("Starting burn test:");
                // TODO: FIXME: replace getBitcoinUTXOs with generic getUTXOs
                const initialBalance = sumUTXOs(await testcase.getUTXOS(network)(srcAddress.toString(), 0));
                await burnTest(testcase.burnToken, erc20Contract, shifterAddress, adapterContract, burnValue, ethAddress, srcAddress.toString());
                // tslint:disable-next-line: no-string-based-set-timeout
                await new Promise((resolve) => { setTimeout(resolve, 10 * 1000); });
                const finalBalance = sumUTXOs(await testcase.getUTXOS(network)(srcAddress.toString(), 0));

                // finalBalance.sub(initialBalance).should.bignumber.at.least(removeVMFee(removeGasFee(new BN(burnValue), 10)));
                // finalBalance.sub(initialBalance).should.bignumber.at.most(removeVMFee(new BN(burnValue)));
                finalBalance.sub(initialBalance).should.bignumber.at.most(new BN(burnValue));
            });
        }

        for (const testcaseFn of [
            { ...caseBTC, it, },
            { ...caseZEC, it: it.skip, },
        ]) {
            // tslint:disable-next-line: mocha-no-side-effect-code
            testcaseFn.it(`should be able to mint ${testcaseFn.name} using the helper function`, async () => {
                const testcase = testcaseFn.fn();

                const adapterContract = "0xC99Ab5d1d0fbf99912dbf0DA1ADC69d4a3a1e9Eb";
                const amount = 0.000225 * (10 ** 8);
                const ethAddress = accounts[0];
                const shifterRegistry = new web3.eth.Contract(network.contracts.addresses.shifter.ShifterRegistry.abi, network.contracts.addresses.shifter.ShifterRegistry.address);
                const shiftedTokenAddress = await shifterRegistry.methods.getTokenBySymbol(testcase.shiftedToken).call();
                const shifterAddress = await shifterRegistry.methods.getShifterBySymbol(testcase.shiftedToken).call();
                const erc20Contract = new web3.eth.Contract(network.contracts.addresses.erc.ERC20.abi, shiftedTokenAddress);

                console.log("Starting mint test:");
                const initialERC20Balance = await checkERC20Balance(erc20Contract, ethAddress);
                await mintTest(
                    testcase.mintToken,
                    shifterAddress,
                    adapterContract,
                    amount,
                    ethAddress,
                    testcase.sendAsset,
                    submitTogether,
                );
                const finalERC20Balance = await checkERC20Balance(erc20Contract, ethAddress);

                // Check the minted amount is at least (amount - renVM fee - 10 bips) and at most (amount - renVM fee).
                const balance = finalERC20Balance.sub(initialERC20Balance); // BN
                // balance.should.bignumber.at.least(removeVMFee(removeGasFee(new BN(amount), 10)));
                balance.should.bignumber.at.most(new BN(amount));
            });
        }
    });
});
