/* eslint-disable no-console */

import * as Chains from "@renproject/chains";
import { Arbitrum, Ethereum, Goerli } from "@renproject/chains-ethereum";

import { LogLevel, RenNetwork, SimpleLogger } from "@renproject/interfaces";
import RenJS from "@renproject/ren";
import { extractError, SECONDS, sleep } from "@renproject/utils";
import chai from "chai";
import { blue, cyan, green, magenta, red, yellow } from "chalk";
import CryptoAccount from "send-crypto";
import HDWalletProvider from "@truffle/hdwallet-provider";
import { config as loadDotEnv } from "dotenv";
import BigNumber from "bignumber.js";
import { RenVMProvider } from "@renproject/rpc/build/main/v2";
import { ethers } from "ethers";

chai.should();

loadDotEnv();

const colors = [green, magenta, yellow, cyan, blue, red];

const MNEMONIC = process.env.MNEMONIC;
const PRIVATE_KEY = process.env.TESTNET_PRIVATE_KEY;
import { renGoerli } from "@renproject/chains";
import { renTestnet } from "@renproject/chains-solana/build/main/networks";
import { makeTestProvider } from "@renproject/chains-solana/build/main/utils";

const FAUCET_ASSETS = ["BTC", "ZEC", "BCH", "ETH", "FIL", "LUNA"];

const testPK = Buffer.from(process.env.TESTNET_SOLANA_KEY, "hex");

describe("Refactor: mint", () => {
    const longIt = process.env.ALL_TESTS ? it : it.skip;
    longIt("mint to contract", async function () {
        this.timeout(100000000000);

        const network = RenNetwork.Testnet;
        const from = Chains.Terra();
        const asset = "LUNA"; // from.asset;

        const toChain = new Chains.Solana(
            makeTestProvider(renTestnet, testPK),
            renTestnet,
        );

        console.log(toChain.provider.wallet.publicKey.toString());

        if ((toChain as any).createAssociatedTokenAccount) {
            console.log("Calling createAssociatedTokenAccount...");
            await (toChain as any).createAssociatedTokenAccount(asset);
        }

        const to = toChain;

        // const ToClass = Arbitrum;
        // const ethNetwork = Arbitrum.configMap[network];

        const account = new CryptoAccount(Buffer.from(PRIVATE_KEY, "hex"), {
            network: "testnet",
            apiAddress: "https://multichain-web-proxy.herokuapp.com/testnet",
            terra: {
                URL: "https://tequila-lcd.terra.dev",
            },
        });

        const logLevel: LogLevel = LogLevel.Trace;
        const renJS = new RenJS(new RenVMProvider(network), { logLevel });

        // const infuraURL = ethNetwork.publicProvider({
        //     infura: process.env.INFURA_KEY,
        // });
        // const hdWalletProvider = new HDWalletProvider({
        //     mnemonic: MNEMONIC || "",
        //     providerOrUrl: infuraURL,
        //     addressIndex: 0,
        //     numberOfAddresses: 10,
        // });

        // const provider = new ethers.providers.Web3Provider(
        //     // eslint-disable-next-line @typescript-eslint/no-explicit-any
        //     hdWalletProvider as any,
        // );
        // const signer = provider.getSigner();

        // const ethAddress = (await provider.listAccounts())[0];
        // const balance = await provider.getBalance(ethAddress);
        // const ethBalance = ethers.utils.formatEther(balance);
        // console.log(`Mint address: ${ethAddress}, balance: ${ethBalance}`);
        // const to = ToClass(provider, ethNetwork).Account({
        //     address: ethAddress,
        // });
        // ToClass({ provider, signer }, ethNetwork).Account(
        //     {
        //         address: ethAddress,
        //     }
        // {
        //     gasLimit: 2000000,
        // },

        const params = {
            asset,
            from,
            to,
        };

        const assetDecimals = params.from.assetDecimals(asset);

        // Use 0.0001 more than fee.
        let suggestedAmount: BigNumber;
        try {
            const fees = await renJS.getFees(params);
            suggestedAmount = fees.lock.div(
                new BigNumber(10).exponentiatedBy(assetDecimals),
            );
        } catch (error) {
            console.error("Error fetching fees:", red(extractError(error)));
            console.error(error);
            if ((asset as string) === "FIL") {
                suggestedAmount = new BigNumber(0.2);
            } else {
                suggestedAmount = new BigNumber(0.0015);
            }
        }

        const lockAndMint = await renJS.lockAndMint(params);

        console.info(
            `Send at least ${suggestedAmount.toFixed()} ${asset} to`,
            lockAndMint.gatewayAddress,
        );

        const faucetSupported =
            network === RenNetwork.Testnet && FAUCET_ASSETS.indexOf(asset) >= 0;

        if (faucetSupported) {
            console.info(
                `${asset} balance: ${await account.balanceOf(
                    asset,
                )} ${asset} (${await account.address(asset)})`,
            );
        }

        // lockAndMint.processDeposit({
        //     transaction: {
        //         txHash:
        //             "b6683eae5f54d6dd7bfa8b5820a5b14f526b15efe76daca9700f2d3359ffe73e",
        //         amount: "159213",
        //         vOut: 0,
        //         confirmations: 0,
        //     },
        //     amount: "159213",
        // });

        await new Promise((resolve, reject) => {
            let i = 0;

            lockAndMint.on("deposit", (deposit) => {
                const hash = deposit.txHash();

                const color = colors[i % colors.length];
                i += 1;

                deposit._state.logger = new SimpleLogger(
                    logLevel,
                    color(`[${hash.slice(0, 6)}]`),
                );

                deposit._state.logger.log(
                    `Received ${
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        new BigNumber((deposit.depositDetails as any).amount)
                            .div(
                                new BigNumber(10).exponentiatedBy(
                                    assetDecimals,
                                ),
                            )
                            .toFixed()
                    } ${asset}`,
                    deposit.depositDetails,
                    deposit.params.from.utils.transactionExplorerLink
                        ? deposit.params.from.utils.transactionExplorerLink(
                              deposit.depositDetails.transaction,
                          )
                        : "",
                );

                RenJS.defaultDepositHandler(deposit)
                    .then(resolve)
                    .catch((error) => {
                        deposit._state.logger.error(red("error:"), error);
                        console.error(error);
                    });
            });

            sleep(30 * SECONDS)
                .then(() => {
                    // If there's been no deposits, send one.
                    if (faucetSupported && i === 0) {
                        const sendAmount = suggestedAmount.times(5);
                        console.log(
                            `${blue("[faucet]")} Sending ${blue(
                                sendAmount.toFixed(),
                            )} ${blue(asset)} to ${blue(
                                typeof lockAndMint.gatewayAddress === "string"
                                    ? lockAndMint.gatewayAddress
                                    : JSON.stringify(
                                          lockAndMint.gatewayAddress,
                                      ),
                            )}`,
                        );

                        const options = { params: undefined, memo: undefined };
                        let address = "";
                        if (typeof lockAndMint.gatewayAddress === "string") {
                            address = lockAndMint.gatewayAddress;
                        } else if (
                            (asset as string) === "FIL" ||
                            (asset as string) === "LUNA"
                        ) {
                            // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
                            address = (
                                lockAndMint.gatewayAddress as unknown as Chains.FilAddress
                            ).address;
                            // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
                            options.params = (
                                lockAndMint.gatewayAddress as unknown as Chains.FilAddress
                            ).params;
                            // options.memo = (lockAndMint.gatewayAddress as TerraAddress);
                        } else {
                            console.error(`Unknown address format.`);
                            return;
                        }
                        account
                            .send(address, sendAmount, asset, options)
                            .catch(reject);
                    }
                })
                .catch(console.error);
        });
    });
});
