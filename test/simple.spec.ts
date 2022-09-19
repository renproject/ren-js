import { Ethereum } from "@renproject/chains-ethereum/src";
import { RenNetwork } from "@renproject/utils";
/* eslint-disable no-console */
import chalk from "chalk";
import { BinanceSmartChain } from "packages/chains/chains/src";
import RenJS from "packages/ren/src";

import { initializeChain } from "./utils/testUtils";

const network = RenNetwork.Testnet;

/**
 * Same as daiToBsc except:
 * - calls `gateway.inSetup.approval` directly instead of looping through `setup`
 * - no retrying on errors
 * - less logs
 */

describe("DAI/toBinanceSmartChain - simpler", () => {
    it("DAI/toBinanceSmartChain - simpler", async () => {
        const ethereum = initializeChain(Ethereum, network);
        const bsc = initializeChain(BinanceSmartChain, network);

        const renJS = new RenJS(network).withChains(ethereum, bsc);

        const gateway = await renJS.gateway({
            asset: ethereum.assets.DAI,
            from: ethereum.Account({ amount: 2, convertUnit: true }),
            to: bsc.Account(),
        });

        console.debug(chalk.cyan("gateway parameters"), gateway.params);

        console.debug(chalk.cyan("calling setup.approval.submit()"));
        await gateway.inSetup.approval.submit({
            txConfig: {
                gasLimit: 1000000,
            },
        });
        await gateway.inSetup.approval.wait();

        console.debug(chalk.cyan("calling in.submit()"));
        await gateway.in.submit().on("progress", console.debug);
        await gateway.in.wait(1);

        await new Promise<void>((resolve, reject) => {
            gateway.on("transaction", (tx) => {
                (async () => {
                    console.debug(chalk.cyan("tx parameters"), tx.params);

                    await tx.in.wait();

                    console.debug(chalk.cyan("calling renVM.submit()"));
                    await tx.renVM.submit().on("progress", console.debug);
                    await tx.renVM.wait();

                    console.debug(chalk.cyan("calling out.submit()"));
                    await tx.out
                        .submit({
                            txConfig: {
                                gasLimit: 1000000,
                            },
                        })
                        .on("progress", console.debug);
                    await tx.out.wait();

                    console.debug(
                        chalk.cyan("Done"),
                        tx.out.progress.transaction,
                    );

                    resolve();
                })().catch(reject);
            });
        });
    }).timeout(100000000000);
});
