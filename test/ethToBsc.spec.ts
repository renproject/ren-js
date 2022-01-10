/* eslint-disable no-console */

import chai from "chai";
import { config as loadDotEnv } from "dotenv";

import {
    BinanceSmartChain,
    Ethereum,
} from "../packages/chains/chains-ethereum/src";
import RenJS from "../packages/ren/src";
import { RenNetwork, utils } from "../packages/utils/src";
import { getEVMProvider, printChain } from "./testUtils";

chai.should();

loadDotEnv();

describe("RenJS Gateway Transaction", () => {
    it("ETH/toBinanceSmartChain", async function () {
        this.timeout(100000000000);

        const network = RenNetwork.Testnet;

        const asset = Ethereum.assets.ETH;
        const ethereum = new Ethereum({
            network,
            ...getEVMProvider(Ethereum as any, network),
        });
        const bsc = new BinanceSmartChain({
            network,
            ...getEVMProvider(BinanceSmartChain as any, network),
        });

        const renJS = new RenJS(network).withChains(bsc, ethereum);

        const gateway = await renJS.gateway({
            asset,
            from: ethereum.Account({ amount: 0.01, convertToWei: true }),
            to: bsc.Account(),
        });

        console.log(
            `${gateway.params.asset} balance on ${gateway.params.from.chain}`,
            (await bsc.getBalance(gateway.params.asset))
                .shiftedBy(-18)
                .toFixed(),
        );

        // Check what set-up calls need to be made
        for (const setupKey of Object.keys(gateway.inSetup)) {
            const setup = gateway.inSetup[setupKey];
            console.log(
                `[${printChain(gateway.params.from.chain)}⇢${printChain(
                    gateway.params.to.chain,
                )}]: Calling ${setupKey} setup for ${String(setup.chain)}`,
            );
            setup.eventEmitter.on("status", console.log);
            await setup.submit();
        }

        console.log(
            `[${printChain(gateway.params.from.chain)}⇢${printChain(
                gateway.params.to.chain,
            )}]: Submitting to ${printChain(gateway.params.to.chain, {
                pad: false,
            })}`,
        );

        gateway.in.eventEmitter.on("status", console.log);
        await gateway.in.submit();
        // Wait for just 1 transaction for now - tx.in.wait() is called below.
        await gateway.in.wait(1);

        await new Promise<void>((resolve, reject) => {
            gateway.on("transaction", (tx) => {
                (async () => {
                    console.log(
                        `[${printChain(gateway.params.from.chain)}⇢${printChain(
                            gateway.params.to.chain,
                        )}]: RenVM hash: ${tx.hash}`,
                    );
                    await tx.fetchStatus();

                    console.log(
                        `[${printChain(gateway.params.from.chain)}⇢${printChain(
                            gateway.params.to.chain,
                        )}][${tx.hash.slice(0, 6)}]: Status: ${tx.status}`,
                    );

                    tx.in.eventEmitter.on("status", (status) =>
                        console.log(
                            `[${printChain(bsc.chain)}⇢${printChain(
                                ethereum.chain,
                            )}][${tx.hash.slice(0, 6)}]: ${
                                status.confirmations || 0
                            }/${status.target} confirmations`,
                        ),
                    );

                    await tx.in.wait();

                    while (true) {
                        try {
                            console.log(`Submitting to RenVM`);
                            tx.renVM.eventEmitter.on("status", console.log);
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
                        `[${printChain(gateway.params.from.chain)}⇢${printChain(
                            gateway.params.to.chain,
                        )}][${tx.hash.slice(0, 6)}]: Submitting to ${printChain(
                            ethereum.chain,
                            {
                                pad: false,
                            },
                        )}`,
                    );

                    tx.out.eventEmitter.on("status", console.log);

                    if (tx.out.submit) {
                        await tx.out.submit();
                    }

                    await tx.out.wait();

                    resolve();
                })().catch(reject);
            });
        });
    });
});
