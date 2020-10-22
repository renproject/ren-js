// NO_COMMIT

// tslint:disable: no-console

/// <reference types="./testutils/chai" />
/// <reference types="./testutils/declarations" />

import { RenNetworkDetails } from "@renproject/networks";
import { sleep, stringToNetwork } from "@renproject/utils";
import BigNumber from "bignumber.js";
import chai from "chai";
import chaiBigNumber from "chai-bignumber";
import chalk from "chalk";
import CryptoAccount from "send-crypto";
import HDWalletProvider from "truffle-hdwallet-provider";
import Web3 from "web3";
import RenJS from "@renproject/ren";

chai.use(chaiBigNumber(BigNumber));
chai.should();

const logger = {
    printLine: (s, overwrite = false) =>
        overwrite
            ? process.stdout.write(`\u001b[0K\r${s}\r`)
            : console.debug(s),
    event: (eventString, { overwrite } = { overwrite: false }) => {
        logger.printLine(`${chalk.blue("[EVENT]")} ${eventString}`, overwrite);
    },
    info: (eventString, { overwrite } = { overwrite: false }) => {
        logger.printLine(`${chalk.yellow("[INFO]")} ${eventString}`, overwrite);
    },
    consoleLine: (divider = "—") => {
        logger.printLine(
            `\n${chalk.yellow(divider.repeat(process.stdout.columns))}`,
        );
    },
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

describe.skip("Cross chain transactions", function () {
    // // Disable test timeout.
    // this.timeout(0);
    // let provider: HDWalletProvider;
    // let web3: Web3;
    // let network: RenNetworkDetails;
    // let renJS: RenJS;
    // let accounts: string[];
    // before(async () => {
    //     network = stringToNetwork(NETWORK || "testnet");
    //     const infuraURL = `${network.infura}/v3/${process.env.INFURA_KEY}`;
    //     provider = new HDWalletProvider(MNEMONIC, infuraURL, 0, 10);
    //     web3 = new Web3(provider);
    //     accounts = await web3.eth.getAccounts();
    //     web3.eth.defaultAccount = accounts[0];
    //     renJS = new RenJS(network);
    // });
    // // tslint:disable-next-line: mocha-no-side-effect-code
    // it("workspace", async () => {
    //     logger.consoleLine();
    //     logger.info(`Starting mint test`);
    //     const amount = RenJS.utils.value(0.0004, "btc").sats().toNumber();
    //     const mint = new RenJS(NETWORK, { logLevel: "trace" }).lockAndMint({
    //         sendToken: RenJS.Tokens.BTC.Btc2Eth,
    //         sendTo: "0x797522Fb74d42bB9fbF6b76dEa24D01A538d5D66",
    //         contractFn: "deposit",
    //         contractParams: [],
    //         web3Provider: web3.currentProvider,
    //     });
    //     const gatewayAddress = await mint.gatewayAddress();
    //     console.log(`Gateway address: ${gatewayAddress}, amount: ${amount / 1e8} BTC`);
    //     const account = new CryptoAccount(PRIVATE_KEY, { network: "testnet" });
    //     logger.info(`BTC balance: ${await account.balanceOf("btc")} ${"btc"} (${await account.address("btc")})`);
    //     await account.sendSats(gatewayAddress, amount, "btc");
    //     // Wait for deposit to be received and submit to Lightnode + Ethereum.
    //     const confirmations = 0;
    //     logger.info(`Waiting for ${confirmations} confirmations...`);
    //     const deposit = await mint.wait(0)
    //         .on("deposit", (depositObject) => { logger.event(`Received a new deposit: ${JSON.stringify(depositObject)}`); });
    //     await sleepWithCountdown(5);
    //     logger.info(`Submitting deposit to RenVM...`);
    //     const signature = await deposit.submit()
    //         .on("txHash", (txHash: string) => {
    //             logger.event(`Received txHash: ${txHash}`);
    //             // deposit.txHash().should.equal(txHash);
    //         })
    //         .on("status", (status) => { logger.event(`Received status: ${chalk.green(status)}`, { overwrite: true }); });
    //     logger.newLine();
    //     logger.info(`Submitting signature to Ethereum...`);
    //     try {
    //         console.log(await web3.eth.getAccounts());
    //         await signature.mint(provider)
    //             .on("eth_transactionHash", (txHash: string) => { logger.event(`Received txHash: ${txHash}`); });
    //         logger.info("Done waiting for Ethereum TX.");
    //     } catch (error) {
    //         logger.error(error);
    //         throw error;
    //     }
    // });
});
