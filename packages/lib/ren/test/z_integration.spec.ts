// tslint:disable: no-console

/// <reference types="./testutils/chai" />
/// <reference types="./testutils/declarations" />

import { RenNetworkDetails } from "@renproject/contracts";
import { EthArgs, LogLevel, RenContract, Tokens } from "@renproject/interfaces";
import {
    Ox,
    parseRenContract,
    retryNTimes,
    SECONDS,
    sleep,
    stringToNetwork,
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

import { BurnAndRelease } from "../src/burnAndRelease";
import RenJS from "../src/index";
import { LockAndMint } from "../src/lockAndMint";

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
        await sleep(1 * SECONDS);
        seconds -= 1;
    }
    process.stdout.write("\u001b[0K\r");
};

require("dotenv").config();

const MNEMONIC = process.env.MNEMONIC;
const NETWORK = process.env.NETWORK;
const PRIVATE_KEY = process.env.TESTNET_PRIVATE_KEY;

describe("Cross chain transactions", function () {
    // Disable test timeout.
    this.timeout(0);

    let provider: HDWalletProvider;
    let web3: Web3;
    let network: RenNetworkDetails;
    let renJS: RenJS;
    let accounts: string[];

    // tslint:disable-next-line: mocha-no-side-effect-code
    const longIt = (process.env.ALL_TESTS ? it : it.skip);

    before(async () => {
        network = stringToNetwork(NETWORK || "testnet");
        const infuraURL = `${network.infura}/v3/${process.env.INFURA_KEY}`;
        provider = new HDWalletProvider(MNEMONIC, infuraURL, 0, 10);
        web3 = new Web3(provider);
        accounts = await web3.eth.getAccounts();
        web3.eth.defaultAccount = accounts[0];
        renJS = new RenJS(network, { logLevel: LogLevel.Warn });
    });

    const checkERC20Balance = async (contract: Contract, address: string): Promise<BN> =>
        new BN((await contract.methods.balanceOf(address).call()).toString());

    const mintTest = async (
        token: string,
        renVMToken: RenContract,
        gatewayContract: string,
        adapterContract: string,
        amount: number,
        ethAddress: string,
        contractVersion: "0.0.3" | "1.0.0",
        submitMint: (mint: LockAndMint) => Promise<void>,
        nonce?: string,
    ): Promise<void> => {
        const params: EthArgs = [
            {
                name: "_symbol",
                type: "string",
                value: token,
            },
            {
                name: "_address",
                type: "address",
                value: ethAddress,
            }
        ];
        const mint = renJS.lockAndMint({
            web3Provider: web3.currentProvider,
            sendToken: renVMToken,
            sendTo: adapterContract,
            // sendAmount: amount,
            contractFn: "mint",
            contractParams: params,
            nonce: nonce || RenJS.utils.randomNonce(),
        });
        const gatewayAddress = await mint.gatewayAddress();

        const account = new CryptoAccount(PRIVATE_KEY, { network: "testnet" });
        logger.info(`${token} balance: ${await account.balanceOf(token)} ${token} (${await account.address(token)})`);
        await account.sendSats(gatewayAddress, amount, token);

        await submitMint(mint);
    };

    const submitIndividual = async (mint: LockAndMint): Promise<void> => {
        // Wait for deposit to be received and submit to Lightnode + Ethereum.
        const confirmations = 0;
        logger.info(`Waiting for ${confirmations} confirmations...`);

        const deposit = await mint.wait(confirmations)
            .on("deposit", (depositObject) => { logger.event(`Received a new deposit: ${JSON.stringify(depositObject)}`); });

        await sleepWithCountdown(5);

        logger.info(`Submitting deposit to RenVM...`);
        const signature = await deposit.submit()
            .on("txHash", (txHash: string) => {
                logger.event(`Received txHash: ${txHash}`);
                // deposit.txHash().should.equal(txHash);
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

    const submitTogether = async (mint: LockAndMint): Promise<void> => {
        // Wait for deposit to be received and submit to Lightnode + Ethereum.
        const confirmations = 0;
        await mint.waitAndSubmit(provider, confirmations);
    };

    const submit = async (burnAndReleaseObject: BurnAndRelease) => {
        try {
            burnAndReleaseObject = await burnAndReleaseObject.readFromEthereum()
                .on("eth_transactionHash", (txHash: string) => { logger.event(`Received txHash: ${txHash}`); });
        } catch (error) {
            logger.error(error);
            throw error;
        }

        await sleepWithCountdown(5);

        logger.info("Submitting burn to RenVM...");

        await burnAndReleaseObject.submit()
            .on("txHash", (txHash) => {
                logger.event(`Received txHash: ${txHash}`);
                logger.info(`burnAndReleaseObject.txHash(): ${burnAndReleaseObject.txHash()}`);
                burnAndReleaseObject.txHash().should.equal(txHash);
            })
            .on("status", (status) => { process.stdout.write(`\u001b[0K\r${chalk.blue("[EVENT]")} Received status: ${chalk.green(status)}\r`); });
        logger.newLine();
    };

    const burnTest = async (
        token: string,
        sendToken: RenContract,
        erc20Contract: Contract,
        gatewayContract: string,
        adapterContract: string,
        amount: number | BigNumber,
        ethAddress: string,
        srcAddress: string,
        contractVersion: "0.0.3" | "1.0.0",
    ) => {
        // Approve contract to spend the token.
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
                name: "_symbol",
                type: "string",
                value: token,
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
        const burnAndReleaseObject: BurnAndRelease = renJS.burnAndRelease({
            sendTo: adapterContract,
            contractFn: "burn",
            contractParams: payload,
            txConfig: { from: ethAddress, gas: 1000000 },

            web3Provider: provider,
            sendToken,
            // txHash: result.transactionHash,
        });

        await submit(burnAndReleaseObject);
    };

    const removeTxFee = (value: BN): BN => value.sub(new BN(7000));
    const removeDarknodeFee = (value: BN, bips: number): BN => value.sub(value.mul(new BN(bips)).div(new BN(10000)));

    describe("minting and burning", () => {
        const caseBTC = { name: "BTC", fn: () => ({ token: "BTC", mintToken: Tokens.BTC.Mint, burnToken: Tokens.BTC.Burn, renToken: "BTC" }) };
        const caseZEC = { name: "ZEC", fn: () => ({ token: "ZEC", mintToken: Tokens.ZEC.Mint, burnToken: Tokens.ZEC.Burn, renToken: "ZEC" }) };
        const caseBCH = { name: "BCH", fn: () => ({ token: "BCH", mintToken: Tokens.BCH.Mint, burnToken: Tokens.BCH.Burn, renToken: "BCH" }) };

        for (const testcaseFn of [
            { ...caseBTC, it: longIt, },
            { ...caseZEC, it: it.skip, },
            { ...caseBCH, it: it.skip, },
        ]) {
            // tslint:disable-next-line: mocha-no-side-effect-code
            testcaseFn.it(`should be able to mint and burn ${testcaseFn.name} to Ethereum`, async () => {
                const testcase = testcaseFn.fn();

                // const adapterContract = "0xC99Ab5d1d0fbf99912dbf0DA1ADC69d4a3a1e9Eb";
                const adapterContract = network.addresses.gateways.BasicAdapter.address;
                const amount = Math.floor(0.0008001 * (10 ** 8));
                const ethAddress = accounts[0];
                const account = new CryptoAccount(PRIVATE_KEY, { network: network.chain });
                const srcAddress = await account.address(testcase.token);
                const registryABI = network.addresses.gateways.GatewayRegistry.abi;
                const registryAddress = network.addresses.gateways.GatewayRegistry.address;
                const gatewayRegistry = new web3.eth.Contract(registryABI, registryAddress);
                const gatewayContract = await gatewayRegistry.methods.getGatewayBySymbol(testcase.renToken).call();
                const renTokenAddress = await gatewayRegistry.methods.getTokenBySymbol(testcase.renToken).call();
                const erc20Contract = new web3.eth.Contract(network.addresses.erc.ERC20.abi, renTokenAddress);

                // Test minting.
                logger.consoleLine();
                logger.info("Starting mint test:");
                const initialERC20Balance = await retryNTimes(() => account.getBalanceInSats<BigNumber>({ type: "ERC20", address: renTokenAddress }, { address: ethAddress, bn: BigNumber }), 5);
                const nonce = RenJS.utils.randomNonce();
                await mintTest(
                    testcase.token,
                    testcase.mintToken,
                    gatewayContract,
                    adapterContract,
                    amount,
                    ethAddress,
                    network.version,
                    submitIndividual,
                    nonce,
                );

                const finalERC20Balance = await retryNTimes(() => account.getBalanceInSats<BigNumber>({ type: "ERC20", address: renTokenAddress }, { address: ethAddress, bn: BigNumber }), 5);

                // Check the minted amount is at least (amount - renVM fee - 10 bips) and at most (amount - renVM fee).
                const balance = finalERC20Balance.minus(initialERC20Balance); // BN
                balance.should.bignumber.at.least(removeDarknodeFee(removeTxFee(new BN(amount)), 10));
                balance.should.bignumber.at.most(new BN(amount));

                // Test burning.
                const burnValue = BigNumber.min(finalERC20Balance, amount);
                // const burnValue = balance.toNumber();
                // amount = 0.00080001 * (10 ** 8);
                // const burnValue = amount;

                logger.consoleLine();
                logger.info("Starting burn test:");
                const initialBalance = await retryNTimes(() => account.getBalanceInSats<BigNumber>(testcase.token, { address: srcAddress, bn: BigNumber }), 5);
                await burnTest(testcase.token, testcase.burnToken, erc20Contract, gatewayContract, adapterContract, burnValue, ethAddress, srcAddress, network.version);
                // tslint:disable-next-line: no-string-based-set-timeout
                await new Promise((resolve) => { setTimeout(resolve, 10 * 1000); });
                const finalBalance = await retryNTimes(() => account.getBalanceInSats<BigNumber>(testcase.token, { address: srcAddress, bn: BigNumber }), 5);

                // finalBalance.sub(initialBalance).should.bignumber.at.least(removeDarknodeFee(removeTxFee(new BN(burnValue)), 10));
                // finalBalance.sub(initialBalance).should.bignumber.at.most(removeTxFee(new BN(burnValue)));
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
                const amount = 0.00080001 * (10 ** 8);
                const ethAddress = accounts[0];
                const registryABI = network.addresses.gateways.GatewayRegistry.abi;
                const registryAddress = network.addresses.gateways.GatewayRegistry.address;
                const gatewayRegistry = new web3.eth.Contract(registryABI, registryAddress);
                const gatewayContract = await gatewayRegistry.methods.getGatewayBySymbol(testcase.renToken).call();
                const renTokenAddress = await gatewayRegistry.methods.getTokenBySymbol(testcase.renToken).call();

                const account = new CryptoAccount(PRIVATE_KEY, { network: network.chain });

                logger.consoleLine();
                logger.info("Starting mint test:");
                const initialERC20Balance = await account.getBalanceInSats<BigNumber>({ type: "ERC20", address: renTokenAddress }, { address: ethAddress, bn: BigNumber });
                await mintTest(
                    testcase.token,
                    testcase.mintToken,
                    gatewayContract,
                    adapterContract,
                    amount,
                    ethAddress,
                    network.version,
                    submitTogether,
                );
                const finalERC20Balance = await account.getBalanceInSats<BigNumber>({ type: "ERC20", address: renTokenAddress }, { address: ethAddress, bn: BigNumber });

                // Check the minted amount is at least (amount - renVM fee - 10 bips) and at most (amount - renVM fee).
                const balance = finalERC20Balance.minus(initialERC20Balance); // BN
                // balance.should.bignumber.at.least(removeDarknodeFee(removeTxFee(new BN(amount)), 10));
                balance.should.bignumber.at.most(amount);
            });
        }
    });

    // tslint:disable-next-line: mocha-no-side-effect-code
    longIt("simple interface - mint", async () => {
        for (const contract of [RenJS.Tokens.BTC.Mint]) {
            logger.consoleLine();
            logger.info(`Starting mint test`);
            const { asset: token } = parseRenContract(contract);
            const amount = RenJS.utils.value(0.000015, token.toLowerCase() as "btc" | "bch" | "zec")._smallest();

            const mint = renJS.lockAndMint({
                web3Provider: web3.currentProvider,
                sendToken: token as "BTC" | "ZEC" | "BCH",
                sendTo: (await web3.eth.getAccounts())[0],
            });

            const gatewayAddress = await mint.gatewayAddress();

            const account = new CryptoAccount(PRIVATE_KEY, { network: "testnet" });
            logger.info(`${token} balance: ${await account.balanceOf(token)} ${token} (${await account.address(token)})`);
            await account.sendSats(gatewayAddress, amount, token);

            await submitIndividual(mint);
        }
    });

    // tslint:disable-next-line: mocha-no-side-effect-code
    longIt("simple interface - burn", async () => {
        for (const contract of [RenJS.Tokens.BTC.Burn]) {
            logger.consoleLine();
            logger.info(`Starting burn test`);

            // TODO: Check balance of token before attempting to mint.

            const { asset: token } = parseRenContract(contract);
            const amount = RenJS.utils.value(0.00080001, token.toLowerCase() as "btc" | "bch" | "zec")._smallest();

            const burn = renJS.burnAndRelease({
                web3Provider: provider,
                sendToken: token as "BTC" | "ZEC" | "BCH",
                sendAmount: amount,
                sendTo: "miMi2VET41YV1j6SDNTeZoPBbmH8B4nEx6",
            });

            await submit(burn);
        }
    });

    it.skip("recover transfer", async () => {
        for (const contract of [RenJS.Tokens.BTC.Mint]) {
            logger.consoleLine();
            logger.info(`Starting mint test - recovering transfer`);
            const { asset: token } = parseRenContract(contract);
            const amount = RenJS.utils.value(0.00080001, token.toLowerCase() as "btc" | "bch" | "zec")._smallest();

            const mint = new RenJS("testnet").lockAndMint({
                web3Provider: web3.currentProvider,
                sendToken: token as "BTC" | "ZEC" | "BCH",
                sendTo: "0xe520ec7e6C0D2A4f44033E2cC8ab641cb80F5176",
            });

            const gatewayAddress = await mint.gatewayAddress();

            const account = new CryptoAccount(PRIVATE_KEY, { network: "testnet" });
            logger.info(`${token} balance: ${await account.balanceOf(token)} ${token} (${await account.address(token)})`);
            await account.sendSats(gatewayAddress, amount, token);

            await submitIndividual(mint);
            await submitIndividual(mint);
        }
    });

    it.skip("recover burn from txHash", async () => {
        logger.consoleLine();
        logger.info(`Starting burn test - recovering burn from txHash`);

        const burnBase64 = new RenJS("devnet").burnAndRelease({
            web3Provider: web3.currentProvider,
            sendToken: "BTC",
            txHash: "FBcH+vnMdybRYgaQB2Hm9rwg3MkgTcQFeh7j3/v10kI=",
        });

        const result64 = await burnBase64.submit();

        const burnHex = new RenJS("devnet").burnAndRelease({
            web3Provider: web3.currentProvider,
            sendToken: "BTC",
            txHash: "0x141707faf9cc7726d16206900761e6f6bc20dcc9204dc4057a1ee3dffbf5d242",
        });

        const resultHex = await burnHex.submit();

        result64.should.deep.equal(resultHex);
    });

    it.skip("recover mint from txHash", async () => {
        logger.consoleLine();
        logger.info(`Starting mint test - recovering mint from txHash`);

        const mintBase64 = new RenJS("devnet").lockAndMint({
            web3Provider: web3.currentProvider,
            sendToken: "BTC",
            txHash: "2+jzYRh/e0KR3nmvu4/IMFs+U8zL1NnJULyStGaFaKM=",
            contractCalls: [],
        });

        const resultBase64 = await mintBase64.queryTx();

        const mintHex = new RenJS("devnet").lockAndMint({
            web3Provider: web3.currentProvider,
            sendToken: "BTC",
            txHash: "0xdbe8f361187f7b4291de79afbb8fc8305b3e53cccbd4d9c950bc92b4668568a3",
            contractCalls: [],
        });

        const resultHex = await mintHex.queryTx();

        resultBase64.should.deep.equal(resultHex);
    });

    // tslint:disable-next-line: mocha-no-side-effect-code
    it.skip("confirmationless", async () => {
        for (const contract of [RenJS.Tokens.BTC.Mint]) {
            logger.consoleLine();
            logger.info(`Starting mint test - recovering transfer`);
            const { asset: token } = parseRenContract(contract);
            const amount = RenJS.utils.value(0.0008, token.toLowerCase() as "btc" | "bch" | "zec")._smallest();

            const adapterContract = network.addresses.gateways.BasicAdapter.address;

            const mint = renJS.lockAndMint({
                web3Provider: web3.currentProvider,
                sendToken: RenJS.Tokens.BTC.Btc2Eth,
                sendTo: adapterContract,
                // sendAmount: amount,
                contractFn: "mint",
                contractParams: [
                    {
                        name: "_symbol",
                        type: "string",
                        value: token,
                    },
                    {
                        name: "_address",
                        type: "address",
                        value: "0x62ACc475F68254941e923958Fcad78e10A4CfF06",
                    }
                ],
                // nonce: nonce || RenJS.utils.randomNonce(),
            });

            const gatewayAddress = await mint.gatewayAddress();

            const account = new CryptoAccount(PRIVATE_KEY, { network: "testnet" });
            logger.info(`${token} balance: ${await account.balanceOf(token)} ${token} (${await account.address(token)})`);
            await account.sendSats(gatewayAddress, amount, token);

            await submitIndividual(mint);
        }
    });

    // tslint:disable-next-line: mocha-no-side-effect-code
    longIt("minting without parameters", async () => {
        logger.consoleLine();
        logger.info(`Starting mint test`);
        const amount = RenJS.utils.value(0.0008, "btc")._smallest();

        const mint = new RenJS("testnet").lockAndMint({
            sendToken: RenJS.Tokens.BTC.Btc2Eth,
            sendTo: "0xE2cAd8EF34E8db287e8daF0eDd169CC9f89E2797",
            contractFn: "deposit",
            contractParams: [],
            web3Provider: web3.currentProvider,
        });

        const gatewayAddress = await mint.gatewayAddress();

        const account = new CryptoAccount(PRIVATE_KEY, { network: "testnet" });
        logger.info(`BTC balance: ${await account.balanceOf("btc")} ${"btc"} (${await account.address("btc")})`);
        await account.sendSats(gatewayAddress, amount, "btc");

        await submitIndividual(mint);
    });
});
