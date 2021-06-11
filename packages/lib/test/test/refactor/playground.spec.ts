/* eslint-disable no-console */

import * as Chains from "@renproject/chains";

import { LogLevel, RenNetwork, SimpleLogger } from "@renproject/interfaces";
import RenJS from "@renproject/ren";
import {
    extractError,
    Ox,
    retryNTimes,
    SECONDS,
    sleep,
} from "@renproject/utils";
import chai from "chai";
import { blue, cyan, green, magenta, red, yellow } from "chalk";
import CryptoAccount from "send-crypto";
import HDWalletProvider from "@truffle/hdwallet-provider";
import { config as loadDotEnv } from "dotenv";
import { DepositStatus } from "@renproject/ren/build/main/lockAndMint";
import { expect } from "earljs";
import BigNumber from "bignumber.js";
import { provider } from "web3-core";

chai.should();

loadDotEnv();

const MNEMONIC = process.env.MNEMONIC;
const PRIVATE_KEY = process.env.TESTNET_PRIVATE_KEY;

const colors = [green, magenta, yellow, cyan, blue, red];

describe("Playground", () => {
    const longIt = process.env.ALL_TESTS ? it : it.skip;
    longIt("mint", async function () {
        this.timeout(100000000000);

        const infuraURL = `${Chains.renTestnetVDot3.infura}/v3/${process.env.INFURA_KEY}`; // renBscTestnetVDot3.infura
        const provider: provider = new HDWalletProvider({
            mnemonic: MNEMONIC || "",
            providerOrUrl: infuraURL,
            addressIndex: 0,
            numberOfAddresses: 10,
        }) as any;

        const asset = "BTC";

        console.log(
            (
                await Chains.Ethereum(
                    provider,
                    RenNetwork.TestnetVDot3,
                ).getBalance(
                    asset,
                    "0xFB87bCF203b78d9B67719b7EEa3b6B65A208961B",
                )
            )
                .dividedBy(
                    new BigNumber(10).exponentiatedBy(
                        Chains.Bitcoin().assetDecimals(asset),
                    ),
                )
                .toFixed(),
            asset,
        );

        // const from = Chains.Bitcoin();
        // const asset = from.asset;
        // // const from = Bitcoin();
        // // const asset = "BTC";
        // const faucetSupported =
        //     ["BTC", "ZEC", "BCH", "ETH", "FIL"].indexOf(asset) >= 0;

        // const account = new CryptoAccount(PRIVATE_KEY, {
        //     network: "testnet",
        //     apiAddress: "https://lotus-cors-proxy.herokuapp.com/",
        // });

        // // const network = renNetworkToEthereumNetwork(NETWORK as RenNetwork);

        // // const infuraURL = `${Chains.renTestnetVDot3.infura}/v3/${process.env.INFURA_KEY}`; // renBscTestnetVDot3.infura
        // const infuraURL = Chains.renBscTestnet.infura;
        // const provider = new HDWalletProvider(MNEMONIC, infuraURL, 0, 10);

        // const to = Chains.BinanceSmartChain(provider, "testnet").Account({
        //     address: "0xFB87bCF203b78d9B67719b7EEa3b6B65A208961B",
        // });

        // const logLevel = LogLevel.Log;
        // const renJS = new RenJS(RenNetwork.Testnet, { logLevel });

        // // Use 0.0001 more than fee.
        // let suggestedAmount: BigNumber | number;
        // try {
        //     const fees = await renJS.getFees({ asset, from, to });
        //     suggestedAmount = fees.lock
        //         .div(
        //             new BigNumber(10).exponentiatedBy(
        //                 from.assetDecimals(asset),
        //             ),
        //         )
        //         .plus(0.0001);
        // } catch (error) {
        //     console.error("Error fetching fees:", red(extractError(error)));
        //     if (asset === "FIL") {
        //         suggestedAmount = 0.01;
        //     } else {
        //         suggestedAmount = 0.0015;
        //     }
        // }

        // const lockAndMint = await renJS.lockAndMint({
        //     asset,
        //     from,
        //     to,

        //     nonce: Ox("12".repeat(32)),
        // });

        // console.info(
        //     `Deposit ${blue(asset)} to ${blue(
        //         typeof lockAndMint.gatewayAddress === "string"
        //             ? lockAndMint.gatewayAddress
        //             : JSON.stringify(lockAndMint.gatewayAddress, null, "    "),
        //     )}`,
        // );

        // // lockAndMint
        // //     .processDeposit({
        // //         transaction: {
        // //             cid:
        // //                 "bafy2bzacedvu74e7ohjcwlh4fbx7ddf6li42fiuosajob6metcj2qwkgkgof2",
        // //             to: "t1v2ftlxhedyoijv7uqgxfygiziaqz23lgkvks77i",
        // //             amount: (0.01 * 1e8).toString(),
        // //             params: "EzGbvVHf8lb0v8CUfjh8y+tLbZzfIFcnNnt/gh6axmw=",
        // //             confirmations: 1,
        // //             nonce: 7,
        // //         },
        // //         amount: (0.01 * 1e8).toString(),
        // //     })
        // //     .catch(console.error);

        // if (faucetSupported) {
        //     console.log(
        //         `${blue("[faucet]")} ${blue(asset)} balance is ${blue(
        //             await account.balanceOf(asset),
        //         )} ${blue(asset)} (${blue(await account.address(asset))})`,
        //     );
        // }

        // await new Promise((resolve, reject) => {
        //     let i = 0;

        //     lockAndMint.on("deposit", (deposit) => {
        //         (async () => {
        //             const hash = deposit.txHash();

        //             // if (deposit.depositDetails.amount === "80000") {
        //             //     return;
        //             // }

        //             const color = colors[i];
        //             i += 1;

        //             deposit._state.logger = new SimpleLogger(
        //                 logLevel,
        //                 color(`[${hash.slice(0, 6)}]`),
        //             );

        //             const info = deposit._state.logger.log;

        //             info(
        //                 `Received ${
        //                     // eslint-disable-next-line @typescript-eslint/no-explicit-any
        //                     (deposit.depositDetails as any).amount / 1e8
        //                 } ${asset}`,
        //                 deposit.depositDetails,
        //             );

        //             const retries = 10;

        //             await retryNTimes(
        //                 async () => {
        //                     deposit._state.logger.log(`Calling .confirmed`);
        //                     await deposit
        //                         .confirmed()
        //                         .on("confirmation", (confs, target) => {
        //                             deposit._state.logger.log(
        //                                 `${confs}/${target} confirmations`,
        //                             );
        //                         });
        //                 },
        //                 retries,
        //                 10 * SECONDS,
        //             );

        //             expect(deposit.status).toEqual(DepositStatus.Confirmed);

        //             await retryNTimes(
        //                 async () => {
        //                     deposit._state.logger.log(`Calling .signed`);
        //                     await deposit.signed().on("status", (status) => {
        //                         deposit._state.logger.log(`status: ${status}`);
        //                     });
        //                 },
        //                 retries,
        //                 10 * SECONDS,
        //             );

        //             expect(deposit.status).toEqual(DepositStatus.Signed);

        //             const response = await retryNTimes(
        //                 async () => {
        //                     deposit._state.logger.log(`Calling .mint`);
        //                     return await deposit
        //                         .mint({
        //                             _extraMsg: "test", // Override value.
        //                         })
        //                         .on("transactionHash", (txHash) => {
        //                             deposit._state.logger.log(
        //                                 `txHash: ${String(txHash)}`,
        //                             );
        //                         });
        //                 },
        //                 retries,
        //                 10 * SECONDS,
        //             );

        //             expect(deposit.status).toEqual(DepositStatus.Submitted);

        //             console.log(response);

        //             resolve();
        //         })().catch(console.error);
        //     });

        //     sleep(20 * SECONDS)
        //         .then(() => {
        //             // If there's been no deposits, send one.
        //             if (faucetSupported && i === 0) {
        //                 console.log(
        //                     `${blue("[faucet]")} Sending ${blue(
        //                         suggestedAmount.toFixed(),
        //                     )} ${blue(asset)} to ${blue(
        //                         typeof lockAndMint.gatewayAddress === "string"
        //                             ? lockAndMint.gatewayAddress
        //                             : JSON.stringify(
        //                                   lockAndMint.gatewayAddress,
        //                               ),
        //                     )}`,
        //                 );
        //                 const options = { params: undefined };
        //                 let address = "";
        //                 if (typeof lockAndMint.gatewayAddress === "string") {
        //                     address = lockAndMint.gatewayAddress;
        //                 } else if (asset === "FIL") {
        //                     // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
        //                     address = (lockAndMint.gatewayAddress as Chains.FilAddress)
        //                         .address;
        //                     // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
        //                     options.params = (lockAndMint.gatewayAddress as Chains.FilAddress).params;
        //                 } else {
        //                     return;
        //                 }
        //                 account
        //                     .send(address, suggestedAmount, asset, options)
        //                     .catch(reject);
        //             }
        //         })
        //         .catch(console.error);
        // });
    });
});
