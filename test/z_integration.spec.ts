// tslint:disable: no-console

/// <reference types="./testutils/chai" />
/// <reference types="./testutils/declarations" />

import { EthArgs, Ox, RenVMType } from "@renproject/ren-js-common";
import BigNumber from "bignumber.js";
import chai from "chai";
import chaiBigNumber from "chai-bignumber";
import chalk from "chalk";
import { BN } from "ethereumjs-util";
import CryptoAccount from "send-crypto";
import HDWalletProvider from "truffle-hdwallet-provider";
import Web3 from "web3";
import { Contract } from "web3-eth-contract";

import RenJS, { ShiftInObject, ShiftOutObject, Token } from "../src/index";
import { retryNTimes, sleep } from "../src/lib/utils";
import { parseRenContract, Tokens } from "../src/types/assets";
import { NetworkDetails, stringToNetwork } from "../src/types/networks";

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
        renVMToken: Token,
        shifterAddress: string,
        adapterContract: string,
        amount: number,
        ethAddress: string,
        submit: (shift: ShiftInObject) => Promise<void>,
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
            sendTo: adapterContract,
            sendToken: renVMToken,
            sendAmount: amount,
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

    const submitIndividual = async (shift: ShiftInObject): Promise<void> => {
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
                deposit.renTxHash().should.equal(renTxHash);
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

    const submitTogether = async (shift: ShiftInObject): Promise<void> => {
        // Wait for deposit to be received and submit to Lightnode + Ethereum.
        const confirmations = 0;
        await shift.waitAndSubmit(provider, confirmations);
    };

    const submitToRenVM = async (shiftOutObject: ShiftOutObject) => {
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
        sendToken: Token,
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

        const shiftOutObject: ShiftOutObject = renJS.shiftOut({
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
            { ...caseZEC, it: it.skip, },
            { ...caseBCH, it: it.skip, },
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
            const amount = RenJS.utils.value(0.01, token.toLowerCase() as "btc" | "bch" | "zec")._smallest();

            const shift = new RenJS("testnet").shiftIn({
                // Send BTC to an Ethereum address
                sendToken: token as "BTC" | "ZEC" | "BCH",

                // Amount of BTC we are sending
                sendAmount: amount,

                // The recipient Ethereum address
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

            const { asset: token } = parseRenContract(contract);
            const amount = RenJS.utils.value(0.01, token.toLowerCase() as "btc" | "bch" | "zec")._smallest();

            const shift = new RenJS("testnet").shiftOut({
                web3Provider: provider,

                // Send BTC to an Ethereum address
                sendToken: token as "BTC" | "ZEC" | "BCH",

                // Amount of BTC we are sending
                sendAmount: amount,

                // The recipient Ethereum address
                sendTo: "miMi2VET41YV1j6SDNTeZoPBbmH8B4nEx6",
            });

            await submitToRenVM(shift);
        }
    });
});
