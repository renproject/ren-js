// tslint:disable: no-console

/// <reference types="./testutils/chai" />
/// <reference types="./testutils/declarations" />

import { EthArgs, Ox, RenContract, RenNetwork, Tokens } from "@renproject/interfaces";
import {
    NetworkDetails, parseRenContract, retryNTimes, sleep, stringToNetwork,
} from "@renproject/utils";
import BigNumber from "bignumber.js";
import chai from "chai";
import chaiBigNumber from "chai-bignumber";
import chalk from "chalk";
import { BN } from "ethereumjs-util";
import CryptoAccount from "send-crypto";
import HDWalletProvider from "truffle-hdwallet-provider";
import Web3 from "web3";
import { Contract } from "web3-eth-contract";

import RenJS from "../src/index";
import { ShiftIn } from "../src/shiftIn";
import { ShiftOut } from "../src/shiftOut";

chai.use((chaiBigNumber)(BigNumber));
chai.should();

const logger = {
    printLine: (s, overwrite = false) => overwrite ? process.stdout.write(`\u001b[0K\r${s}\r`) : console.debug(s),
    event: (eventString, { overwrite } = { overwrite: false }) => { logger.printLine(`${chalk.blue("[EVENT]")} ${eventString}`, overwrite); },
    info: (eventString, { overwrite } = { overwrite: false }) => { logger.printLine(`${chalk.yellow("[INFO]")} ${eventString}`, overwrite); },
    consoleLine: (divider = "—") => { logger.printLine(`\n${chalk.yellow(divider.repeat(process.stdout.columns))}`); },
    error: (error) => logger.printLine(chalk.red(`[ERROR] ${error}`)),
    newLine: () => logger.printLine(""),
};

// A debug `sleep`. It prints a count-down to the console.
// tslint:disable-next-line: no-string-based-set-timeout
export const sleepWithCountdown = async (seconds: number) => {
    while (seconds) {
        process.stdout.write(`\u001b[0K\r${seconds}\r`);
        await sleep(1000);
        seconds -= 1;
    }
    process.stdout.write("\u001b[0K\r");
};

require("dotenv").config();

const MNEMONIC = process.env.MNEMONIC;
const NETWORK = process.env.NETWORK;
const PRIVATE_KEY = process.env.TESTNET_PRIVATE_KEY;

describe("Shifting in and shifting out", function () {
    // Disable test timeout.
    this.timeout(0);

    let provider: HDWalletProvider;
    let web3: Web3;
    let network: NetworkDetails;
    let renJS: RenJS;
    let accounts: string[];

    before(async () => {
        const infuraURL = `https://kovan.infura.io/v3/${process.env.INFURA_KEY}`;
        provider = new HDWalletProvider(MNEMONIC, infuraURL, 0, 10);
        web3 = new Web3(provider);
        accounts = await web3.eth.getAccounts();
        web3.eth.defaultAccount = accounts[0];
        network = stringToNetwork(NETWORK || "testnet");
        renJS = new RenJS(network);
    });

    const checkERC20Balance = async (contract: Contract, address: string): Promise<BN> =>
        new BN((await contract.methods.balanceOf(address).call()).toString());

    const mintTest = async (
        token: string,
        renVMToken: RenContract,
        shifterAddress: string,
        adapterContract: string,
        amount: number,
        ethAddress: string,
        submit: (shift: ShiftIn) => Promise<void>,
        nonce?: string,
    ): Promise<void> => {
        const params: EthArgs = [
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
        const shift = renJS.shiftIn({
            sendToken: renVMToken,
            sendTo: adapterContract,
            // sendAmount: amount,
            contractFn: "shiftIn",
            contractParams: params,
            nonce: nonce || RenJS.utils.randomNonce(),
        });
        const gatewayAddress = shift.addr();

        const account = new CryptoAccount(PRIVATE_KEY, { network: "testnet" });
        logger.info(`${token} balance: ${await account.balanceOf(token)} ${token} (${await account.address(token)})`);
        await account.sendSats(gatewayAddress, amount, token);

        await submit(shift);
    };

    const submitIndividual = async (shift: ShiftIn): Promise<void> => {
        // Wait for deposit to be received and submit to Lightnode + Ethereum.
        const confirmations = 0;
        logger.info(`Waiting for ${confirmations} confirmations...`);

        const deposit = await shift.waitForDeposit(confirmations)
            .on("deposit", (depositObject) => { logger.event(`Received a new deposit: ${JSON.stringify(depositObject)}`); });

        await sleepWithCountdown(5);

        logger.info(`Submitting deposit to RenVM...`);
        const signature = await deposit.submitToRenVM()
            .on("renTxHash", (renTxHash: string) => {
                logger.event(`Received renTxHash: ${renTxHash}`);
                // deposit.renTxHash().should.equal(renTxHash);
            })
            .on("status", (status) => { logger.event(`Received status: ${chalk.green(status)}`, { overwrite: true }); });
        logger.newLine();

        logger.info(`Submitting signature to Ethereum...`);
        try {
            await signature.submitToEthereum(provider, { gas: 1000000 })
                .on("eth_transactionHash", (txHash: string) => { logger.event(`Received txHash: ${txHash}`); });
            logger.info("Done waiting for Ethereum TX.");
        } catch (error) {
            logger.error(error);
            throw error;
        }
    };

    const submitTogether = async (shift: ShiftIn): Promise<void> => {
        // Wait for deposit to be received and submit to Lightnode + Ethereum.
        const confirmations = 0;
        await shift.waitAndSubmit(provider, confirmations);
    };

    const submitToRenVM = async (shiftOutObject: ShiftOut) => {
        try {
            shiftOutObject = await shiftOutObject.readFromEthereum()
                .on("eth_transactionHash", (txHash: string) => { logger.event(`Received txHash: ${txHash}`); });
        } catch (error) {
            logger.error(error);
            throw error;
        }

        await sleepWithCountdown(5);

        logger.info("Submitting burn to RenVM...");

        await shiftOutObject.submitToRenVM()
            .on("renTxHash", (renTxHash) => {
                logger.event(`Received renTxHash: ${renTxHash}`);
                logger.info(`shiftOutObject.renTxHash(): ${shiftOutObject.renTxHash()}`);
                shiftOutObject.renTxHash().should.equal(renTxHash);
            })
            .on("status", (status) => { process.stdout.write(`\u001b[0K\r${chalk.blue("[EVENT]")} Received status: ${chalk.green(status)}\r`); });
        logger.newLine();
    };

    const burnTest = async (
        token: string,
        sendToken: RenContract,
        erc20Contract: Contract,
        shifterAddress: string,
        adapterContract: string,
        amount: number | BigNumber,
        ethAddress: string,
        srcAddress: string,
    ) => {
        // Approve contract to spend the shifted token.
        const approvePayload: EthArgs = [
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

        logger.info("Approving contract.");
        await new Promise((resolve, reject) => erc20Contract.methods.approve(
            ...approveParams,
        ).send({ from: ethAddress, gas: 1000000 })
            .on("transactionHash", (txHash: string) => { logger.event(`Received txHash: ${txHash}`); })
            .on("confirmation", resolve)
            .catch((error: Error) => {
                if (error && error.message && error.message.match(/Invalid block number/)) {
                    logger.error(error);
                    return;
                }
                reject(error);
            })
        );

        // Send burn request to adapter contract.
        const payload: EthArgs = [
            {
                name: "_shifter",
                type: "address",
                value: shifterAddress,
            },
            {
                name: "_to",
                type: "bytes",
                value: RenJS.utils[token.toLowerCase() as "btc" | "zec" | "bch"].addressToHex(srcAddress),
            },
            {
                name: "_amount",
                type: "uint256",
                value: Ox(amount.toString(16)),
            },
        ];

        logger.info("Reading burn from Ethereum.");

        const shiftOutObject: ShiftOut = renJS.shiftOut({
            sendTo: adapterContract,
            contractFn: "shiftOut",
            contractParams: payload,
            txConfig: { from: ethAddress, gas: 1000000 },

            web3Provider: provider,
            sendToken,
            // txHash: result.transactionHash,
        });

        await submitToRenVM(shiftOutObject);
    };

    const removeVMFee = (value: BN): BN => value.sub(new BN(10000));
    const removeGasFee = (value: BN, bips: number): BN => value.sub(value.mul(new BN(bips)).div(new BN(10000)));

    describe("minting and burning", () => {
        const caseBTC = { name: "BTC", fn: () => ({ token: "BTC", mintToken: Tokens.BTC.Mint, burnToken: Tokens.BTC.Burn, shiftedToken: "zBTC", shifter: network.contracts.addresses.shifter.BTCShifter }) };
        const caseZEC = { name: "ZEC", fn: () => ({ token: "ZEC", mintToken: Tokens.ZEC.Mint, burnToken: Tokens.ZEC.Burn, shiftedToken: "zZEC", shifter: network.contracts.addresses.shifter.ZECShifter }) };
        const caseBCH = { name: "BCH", fn: () => ({ token: "BCH", mintToken: Tokens.BCH.Mint, burnToken: Tokens.BCH.Burn, shiftedToken: "zBCH", shifter: network.contracts.addresses.shifter.BCHShifter }) };

        for (const testcaseFn of [
            { ...caseBTC, it, },
            { ...caseZEC, it, },
            { ...caseBCH, it, },
        ]) {
            // tslint:disable-next-line: mocha-no-side-effect-code
            testcaseFn.it(`should be able to mint and burn ${testcaseFn.name} to Ethereum`, async () => {
                const testcase = testcaseFn.fn();

                const adapterContract = "0xC99Ab5d1d0fbf99912dbf0DA1ADC69d4a3a1e9Eb";
                const amount = Math.floor(0.00015 * (10 ** 8));
                const ethAddress = accounts[0];
                const account = new CryptoAccount(PRIVATE_KEY, { network: network.ethNetwork });
                const srcAddress = await account.address(testcase.token);
                const shifterRegistry = new web3.eth.Contract(network.contracts.addresses.shifter.ShifterRegistry.abi, network.contracts.addresses.shifter.ShifterRegistry.address);
                const shiftedTokenAddress = await shifterRegistry.methods.getTokenBySymbol(testcase.shiftedToken).call();
                const shifterAddress = await shifterRegistry.methods.getShifterBySymbol(testcase.shiftedToken).call();
                const erc20Contract = new web3.eth.Contract(network.contracts.addresses.erc.ERC20.abi, shiftedTokenAddress);

                // Test minting.
                logger.consoleLine();
                logger.info("Starting mint test:");
                const initialERC20Balance = await retryNTimes(() => account.getBalanceInSats<BigNumber>({ type: "ERC20", address: shiftedTokenAddress }, { address: ethAddress, bn: BigNumber }), 5);
                const nonce = RenJS.utils.randomNonce();
                await mintTest(
                    testcase.token,
                    testcase.mintToken,
                    shifterAddress,
                    adapterContract,
                    amount,
                    ethAddress,
                    submitIndividual,
                    nonce,
                );

                const finalERC20Balance = await retryNTimes(() => account.getBalanceInSats<BigNumber>({ type: "ERC20", address: shiftedTokenAddress }, { address: ethAddress, bn: BigNumber }), 5);

                // Check the minted amount is at least (amount - renVM fee - 10 bips) and at most (amount - renVM fee).
                const balance = finalERC20Balance.minus(initialERC20Balance); // BN
                balance.should.bignumber.at.least(removeVMFee(removeGasFee(new BN(amount), 10)));
                balance.should.bignumber.at.most(new BN(amount));

                // // Test burning.
                const burnValue = finalERC20Balance;
                // const burnValue = balance.toNumber();
                // amount = 0.000225 * (10 ** 8);
                // const burnValue = amount;

                logger.consoleLine();
                logger.info("Starting burn test:");
                const initialBalance = await retryNTimes(() => account.getBalanceInSats<BigNumber>(testcase.token, { address: srcAddress, bn: BigNumber }), 5);
                await burnTest(testcase.token, testcase.burnToken, erc20Contract, shifterAddress, adapterContract, burnValue, ethAddress, srcAddress);
                // tslint:disable-next-line: no-string-based-set-timeout
                await new Promise((resolve) => { setTimeout(resolve, 10 * 1000); });
                const finalBalance = await retryNTimes(() => account.getBalanceInSats<BigNumber>(testcase.token, { address: srcAddress, bn: BigNumber }), 5);

                // finalBalance.sub(initialBalance).should.bignumber.at.least(removeVMFee(removeGasFee(new BN(burnValue), 10)));
                // finalBalance.sub(initialBalance).should.bignumber.at.most(removeVMFee(new BN(burnValue)));
                finalBalance.minus(initialBalance).should.be.bignumber.at.most(burnValue);
            });
        }

        for (const testcaseFn of [
            { ...caseBTC, it: it.skip, },
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

                const account = new CryptoAccount(PRIVATE_KEY, { network: network.ethNetwork });

                logger.consoleLine();
                logger.info("Starting mint test:");
                const initialERC20Balance = await account.getBalanceInSats<BigNumber>({ type: "ERC20", address: shiftedTokenAddress }, { address: ethAddress, bn: BigNumber });
                await mintTest(
                    testcase.token,
                    testcase.mintToken,
                    shifterAddress,
                    adapterContract,
                    amount,
                    ethAddress,
                    submitTogether,
                );
                const finalERC20Balance = await account.getBalanceInSats<BigNumber>({ type: "ERC20", address: shiftedTokenAddress }, { address: ethAddress, bn: BigNumber });

                // Check the minted amount is at least (amount - renVM fee - 10 bips) and at most (amount - renVM fee).
                const balance = finalERC20Balance.minus(initialERC20Balance); // BN
                // balance.should.bignumber.at.least(removeVMFee(removeGasFee(new BN(amount), 10)));
                balance.should.bignumber.at.most(amount);
            });
        }
    });

    it.skip("simple interface - mint", async () => {
        for (const contract of [RenJS.Tokens.BTC.Mint]) {
            logger.consoleLine();
            logger.info(`Starting mint test`);
            const { asset: token } = parseRenContract(contract);
            const amount = RenJS.utils.value(0.000225, token.toLowerCase() as "btc" | "bch" | "zec")._smallest();

            const shift = new RenJS("testnet").shiftIn({
                sendToken: token as "BTC" | "ZEC" | "BCH",
                sendTo: "0xe520ec7e6C0D2A4f44033E2cC8ab641cb80F5176",
            });

            const gatewayAddress = shift.addr();

            const account = new CryptoAccount(PRIVATE_KEY, { network: "testnet" });
            logger.info(`${token} balance: ${await account.balanceOf(token)} ${token} (${await account.address(token)})`);
            await account.sendSats(gatewayAddress, amount, token);

            await submitIndividual(shift);
        }
    });

    it.skip("simple interface - burn", async () => {
        for (const contract of [RenJS.Tokens.BTC.Burn]) {
            logger.consoleLine();
            logger.info(`Starting burn test`);

            // TODO: Check balance of token before attempting to mint.

            const { asset: token } = parseRenContract(contract);
            const amount = RenJS.utils.value(0.000225, token.toLowerCase() as "btc" | "bch" | "zec")._smallest();

            const shift = new RenJS("testnet").shiftOut({
                web3Provider: provider,
                sendToken: token as "BTC" | "ZEC" | "BCH",
                sendAmount: amount,
                sendTo: "miMi2VET41YV1j6SDNTeZoPBbmH8B4nEx6",
            });

            await submitToRenVM(shift);
        }
    });

    it.skip("recover trade", async () => {
        for (const contract of [RenJS.Tokens.BTC.Mint]) {
            logger.consoleLine();
            logger.info(`Starting mint test - recovering trade`);
            const { asset: token } = parseRenContract(contract);
            const amount = RenJS.utils.value(0.000225, token.toLowerCase() as "btc" | "bch" | "zec")._smallest();

            const shift = new RenJS("testnet").shiftIn({
                sendToken: token as "BTC" | "ZEC" | "BCH",
                sendTo: "0xe520ec7e6C0D2A4f44033E2cC8ab641cb80F5176",
            });

            const gatewayAddress = shift.addr();

            const account = new CryptoAccount(PRIVATE_KEY, { network: "testnet" });
            logger.info(`${token} balance: ${await account.balanceOf(token)} ${token} (${await account.address(token)})`);
            await account.sendSats(gatewayAddress, amount, token);

            await submitIndividual(shift);
            await submitIndividual(shift);
        }
    });

    it.skip("recover burn from renTxHash", async () => {
        logger.consoleLine();
        logger.info(`Starting burn test - recovering burn from renTxHash`);

        const shift64 = new RenJS("devnet").shiftOut({
            sendToken: "BTC",
            renTxHash: "FBcH+vnMdybRYgaQB2Hm9rwg3MkgTcQFeh7j3/v10kI=",
        });

        const result64 = await shift64.submitToRenVM();

        const shiftHex = new RenJS("devnet").shiftOut({
            sendToken: "BTC",
            renTxHash: "0x141707faf9cc7726d16206900761e6f6bc20dcc9204dc4057a1ee3dffbf5d242",
        });

        const resultHex = await shiftHex.submitToRenVM();

        result64.should.deep.equal(resultHex);
    });

    it.skip("recover mint from renTxHash", async () => {
        logger.consoleLine();
        logger.info(`Starting mint test - recovering mint from renTxHash`);

        const shift64 = new RenJS("devnet").shiftIn({
            sendToken: "BTC",
            renTxHash: "2+jzYRh/e0KR3nmvu4/IMFs+U8zL1NnJULyStGaFaKM=",
            contractCalls: [],
        });

        const result64 = await shift64.queryTx();

        const shiftHex = new RenJS("devnet").shiftIn({
            sendToken: "BTC",
            renTxHash: "0xdbe8f361187f7b4291de79afbb8fc8305b3e53cccbd4d9c950bc92b4668568a3",
            contractCalls: [],
        });

        const resultHex = await shiftHex.queryTx();

        result64.should.deep.equal(resultHex);
    });

    it.skip("confirmationless", async () => {
        for (const contract of [RenJS.Tokens.BTC.Mint]) {
            logger.consoleLine();
            logger.info(`Starting mint test - recovering trade`);
            const { asset: token } = parseRenContract(contract);
            const amount = RenJS.utils.value(0.00015, token.toLowerCase() as "btc" | "bch" | "zec")._smallest();

            const tokenAddress = await renJS.getTokenAddress(web3, contract);
            const shifterAddress = await renJS.getShifterAddress(web3, contract);

            const shift = new RenJS("devnet").shiftIn({
                web3Provider: provider,
                sendToken: token as "BTC" | "ZEC" | "BCH",
                contractCalls: [{
                    sendTo: "0x1D88792D94933640EaBA06672f26f9d8c2d4CBcD",
                    contractFn: "shiftIn",
                    contractParams: [
                        { type: "address", name: "_shifter", value: shifterAddress, },
                        { type: "address", name: "_shiftedToken", value: tokenAddress, },
                        { type: "address", name: "_address", value: "0x790ea424d35c4d53f364cfd95dc25a41e415edd7", },
                    ],
                }],
            });

            const gatewayAddress = shift.addr();

            const account = new CryptoAccount(PRIVATE_KEY, { network: "testnet" });
            logger.info(`${token} balance: ${await account.balanceOf(token)} ${token} (${await account.address(token)})`);
            await account.sendSats(gatewayAddress, amount, token);

            await submitIndividual(shift);
        }
    });
});
