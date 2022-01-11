/* eslint-disable no-console */

import chai from "chai";
import { config as loadDotEnv } from "dotenv";

import {
    Arbitrum,
    Avalanche,
    BinanceSmartChain,
    Ethereum,
    Fantom,
    Goerli,
    Polygon,
} from "../packages/chains/chains-ethereum/src";
import RenJS from "../packages/ren/src";
import { RenNetwork, utils } from "../packages/utils/src";
import { getEVMProvider, printChain } from "./testUtils";

chai.should();

loadDotEnv();

const randomElement = <T>(array: T[]): T =>
    array[Math.floor(Math.random() * array.length)];

describe("RenJS Gateway Transaction", () => {
    it("Random H2H", async function () {
        this.timeout(100000000000);

        const network = RenNetwork.Mainnet;

        const ethereum = new Ethereum({
            network,
            ...getEVMProvider(Ethereum, network),
        });
        const bsc = new BinanceSmartChain({
            network,
            ...getEVMProvider(BinanceSmartChain, network),
        });
        const arbitrum = new Arbitrum({
            network,
            ...getEVMProvider(Arbitrum, network),
        });
        const avalanche = new Avalanche({
            network,
            ...getEVMProvider(Avalanche, network),
        });
        const fantom = new Fantom({
            network,
            ...getEVMProvider(Fantom, network),
        });
        const polygon = new Polygon({
            network,
            ...getEVMProvider(Polygon, network),
        });

        const chains = [ethereum, bsc, arbitrum, avalanche, fantom, polygon];

        const renJS = new RenJS(network).withChains(...chains);

        while (true) {
            try {
                const from = randomElement(chains);
                const to = randomElement(
                    chains.filter((chain) => chain.chain !== from.chain),
                );

                await to.getMintGateway("BTC");

                const asset = randomElement(Object.values(from.assets));

                const fromBalance = await from.getBalance(asset);
                const assetDecimals = await from.assetDecimals(asset);

                const amount = fromBalance.dividedBy(10).integerValue();

                if (amount.isZero()) {
                    console.log(
                        `Skipping ${asset} from ${from.chain} to ${to.chain}.`,
                    );
                    continue;
                }

                console.log(
                    `Moving ${amount
                        .shiftedBy(-assetDecimals)
                        .toFixed()}${asset} from ${from.chain} to ${to.chain}`,
                );

                const gateway = await renJS.gateway({
                    asset,
                    from: from.Account({ amount }),
                    to: to.Account(),
                });

                // Check what set-up calls need to be made
                for (const setupKey of Object.keys(gateway.inSetup)) {
                    const setup = gateway.inSetup[setupKey];
                    console.log(
                        `[${printChain(gateway.params.from.chain)}⇢${printChain(
                            gateway.params.to.chain,
                        )}]: Calling ${setupKey} setup for ${String(
                            setup.chain,
                        )}`,
                    );
                    // setup.eventEmitter.on("progress", console.log);
                    await setup.submit();
                }

                console.log(
                    `[${printChain(gateway.params.from.chain)}⇢${printChain(
                        gateway.params.to.chain,
                    )}]: Submitting to ${printChain(gateway.params.to.chain, {
                        pad: false,
                    })}`,
                );

                // gateway.in.eventEmitter.on("progress", console.log);
                await gateway.in.submit();
                // Wait for just 1 transaction for now - tx.in.wait() is called below.
                await gateway.in.wait(1);

                await new Promise<void>((resolve, reject) => {
                    gateway.on("transaction", (tx) => {
                        (async () => {
                            console.log(
                                `[${printChain(
                                    gateway.params.from.chain,
                                )}⇢${printChain(
                                    gateway.params.to.chain,
                                )}]: RenVM hash: ${tx.hash}`,
                            );

                            tx.in.eventEmitter.on("progress", (progress) =>
                                console.log(
                                    `[${printChain(
                                        gateway.params.from.chain,
                                    )}⇢${printChain(
                                        gateway.params.to.chain,
                                    )}][${tx.hash.slice(0, 6)}]: ${
                                        progress.confirmations || 0
                                    }/${progress.target} confirmations`,
                                ),
                            );

                            await tx.in.wait();

                            while (true) {
                                try {
                                    console.log(`Submitting to RenVM`);
                                    // tx.renVM.eventEmitter.on("progress", console.log);
                                    await tx.renVM.submit();
                                    await tx.renVM.wait();
                                    break;
                                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                                } catch (error: any) {
                                    console.error(error);
                                    await utils.sleep(10 * utils.sleep.SECONDS);
                                }
                            }
                            console.log(
                                `[${printChain(
                                    gateway.params.from.chain,
                                )}⇢${printChain(
                                    gateway.params.to.chain,
                                )}][${tx.hash.slice(
                                    0,
                                    6,
                                )}]: Submitting to ${printChain(
                                    gateway.params.to.chain,
                                    {
                                        pad: false,
                                    },
                                )}`,
                            );

                            // tx.out.eventEmitter.on("progress", console.log);

                            if (tx.out.submit) {
                                await tx.out.submit();
                            }

                            await tx.out.wait();

                            resolve();
                        })().catch(reject);
                    });
                });
            } catch (error) {
                console.error(error);
            }
        }
    });
});
