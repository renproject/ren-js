/* eslint-disable no-console */
import chalk from "chalk";

import { Ethereum } from "../packages/chains/chains-ethereum/src";
import { BinanceSmartChain } from "../packages/chains/chains/src";
import RenJS from "../packages/ren/src";
import { RenNetwork } from "../packages/utils/build/main";
import { getEVMProvider } from "./testUtils";

const network = RenNetwork.Testnet;

/**
 * Same as daiToBsc except:
 * - calls `gateway.setup.approval` directly instead of looping through `setup`
 * - no retrying on errors
 * - less logs
 */

describe("RenJS Gateway Transaction", () => {
    it("DAI/toBinanceSmartChain - simpler", async function () {
        this.timeout(100000000000);

        const ethereum = new Ethereum(
            network,
            getEVMProvider(Ethereum, network),
        );
        const bsc = new BinanceSmartChain(
            network,
            getEVMProvider(BinanceSmartChain, network),
        );

        const renJS = new RenJS(network).withChains(ethereum, bsc);

        const gateway = await renJS.gateway({
            asset: ethereum.assets.DAI,
            from: ethereum.Account({ amount: 1, convertToWei: true }),
            to: bsc.Account(),
        });

        console.log(chalk.cyan("gateway parameters"), gateway.params);

        console.log(chalk.cyan("calling setup.approval.submit()"));
        await gateway.setup.approval.submit();
        await gateway.setup.approval.wait();

        console.log(chalk.cyan("calling in.submit()"));
        await gateway.in.submit().on("status", console.log);
        await gateway.in.wait(1);

        await new Promise<void>((resolve, reject) => {
            gateway.on("transaction", (tx) => {
                (async () => {
                    console.log(chalk.cyan("tx parameters"), tx.params);

                    await tx.in.wait();

                    console.log(chalk.cyan("calling renVM.submit()"));
                    await tx.renVM.submit().on("status", console.log);
                    await tx.renVM.wait();

                    console.log(chalk.cyan("calling out.submit()"));
                    await tx.out.submit().on("status", console.log);
                    await tx.out.wait();

                    console.log(chalk.cyan("Done"), tx.out.status.transaction);

                    resolve();
                })().catch(reject);
            });
        });
    });
});
