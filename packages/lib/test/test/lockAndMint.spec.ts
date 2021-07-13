/* eslint-disable no-console */

import * as Chains from "@renproject/chains";

import { LogLevel, RenNetwork, SimpleLogger } from "@renproject/interfaces";
import RenJS from "@renproject/ren";
import { extractError } from "@renproject/utils";
import chai from "chai";
import { blue, cyan, green, magenta, red, yellow } from "chalk";
import { config as loadDotEnv } from "dotenv";
import BigNumber from "bignumber.js";
import Web3 from "web3";
import { RenVMProvider } from "@renproject/rpc/build/main/v2";
import { ethers } from "ethers";
import { it, before } from "mocha";
import { MockProvider, MockChain } from "@renproject/mock-provider";

import { setupLocalNetwork } from "@renproject/gateway-sol/scripts/setupLocalNetwork";

chai.should();

loadDotEnv();

const colors = [green, magenta, yellow, cyan, blue, red];

describe("Refactor: mint", () => {
    let ganache: any;
    before(async () => {
        let hre;
        // eslint-disable-next-line prefer-const
        hre = require("hardhat");
        ganache = require("ganache-core");
        await setupLocalNetwork();
    });

    it.only("mint to contract", async function () {
        this.timeout(100000000000);

        const network = RenNetwork.TestnetVDot3;
        const ToClass = Chains.Polygon;
        const from = new MockChain("BTC");
        const asset = "BTC";

        const mockProvider = new MockProvider();
        mockProvider.registerChain(from);

        const ethNetwork = ToClass.configMap[network];

        const logLevel: LogLevel = LogLevel.Log;
        const renJS = new RenJS(new RenVMProvider("testnet", mockProvider), {
            logLevel,
        });

        const ganacheProvider = ganache.provider();

        const web3 = new Web3(ganacheProvider);
        const ethAddress = (await web3.eth.getAccounts())[0];
        const ethBalance = web3.utils.fromWei(
            await web3.eth.getBalance(ethAddress),
            "ether",
        );
        console.log(`Mint address: ${ethAddress}, balance: ${ethBalance}`);

        const provider = new ethers.providers.Web3Provider(ganacheProvider);
        const signer = provider.getSigner();

        const params = {
            asset,
            from,
            to: ToClass(
                {
                    provider: provider as any,
                    signer: signer as any,
                },
                ethNetwork,
            ).Account({
                address: ethAddress,
            }),
        };

        const assetDecimals = params.from.assetDecimals(asset);

        // Use 0.0001 more than fee.
        let suggestedAmount: BigNumber;
        try {
            const fees = await renJS.getFees(params);
            suggestedAmount = (fees.lock || new BigNumber(0)).div(
                new BigNumber(10).exponentiatedBy(assetDecimals),
            );
        } catch (error) {
            console.error("Error fetching fees:", red(extractError(error)));
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

        from.addUTXO(lockAndMint.gatewayAddress || "", suggestedAmount);

        await new Promise((resolve) => {
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
                    .catch((error) =>
                        deposit._state.logger.error(red("error:"), error),
                    );
            });
        });
    });
});
