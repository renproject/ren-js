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

describe("DAI/toBinanceSmartChain", () => {
    it("DAI/toBinanceSmartChain", async function () {
        this.timeout(100000000000);

        const network = RenNetwork.Testnet;

        const asset = Ethereum.assets.DAI;
        const ethereum = new Ethereum({
            network,
            ...getEVMProvider(Ethereum as any, network),
        });
        const bsc = new BinanceSmartChain({
            network,
            ...getEVMProvider(BinanceSmartChain as any, network),
        });

        // , {
        //     logger: console,
        //     logLevel: LogLevel.Debug,
        // }
        const renJS = new RenJS(network).withChains(bsc, ethereum);

        const gateway = await renJS.gateway({
            asset,
            from: ethereum.Account({ amount: 1, convertToWei: true }),
            // from: ethereum.Transaction({
            //     chain: "Ethereum",
            //     txidFormatted:
            //         "0x27a7df5508abf38946ee418c120c7ad9ae1c682ea5b7d9c6a5fa92b730cf3946",
            //     txid: "J6ffVQir84lG7kGMEgx62a4caC6lt9nGpfqStzDPOUY",
            //     txindex: "0",
            // }),
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
            setup.eventEmitter.on("progress", (progress) =>
                console.log(
                    `[${printChain(gateway.params.from.chain)}⇢${printChain(
                        gateway.params.to.chain,
                    )}]`,
                    progress,
                ),
            );
            await setup.submit();
            await setup.wait();
        }

        console.log(
            `[${printChain(gateway.params.from.chain)}⇢${printChain(
                gateway.params.to.chain,
            )}]: Submitting to ${printChain(gateway.params.from.chain, {
                pad: false,
            })}`,
        );

        gateway.in.eventEmitter.on("progress", (progress) =>
            console.log(
                `[${printChain(gateway.params.from.chain)}⇢${printChain(
                    gateway.params.to.chain,
                )}]`,
                progress,
            ),
        );
        if (gateway.in.submit) {
            await gateway.in.submit();
        }
        // Wait for just 1 transaction for now - tx.in.wait() is called below.
        await gateway.in.wait(1);

        await new Promise<void>((resolve, reject) => {
            gateway.on("transaction", (tx) => {
                (async () => {
                    console.log(
                        `[${printChain(gateway.fromChain.chain)}⇢${printChain(
                            gateway.toChain.chain,
                        )}]: RenVM hash: ${tx.hash}`,
                    );

                    tx.in.eventEmitter.on("progress", (progress) =>
                        console.log(
                            `[${printChain(
                                gateway.fromChain.chain,
                            )}⇢${printChain(
                                gateway.toChain.chain,
                            )}][${tx.hash.slice(0, 6)}]: ${
                                progress.confirmations || 0
                            }/${progress.target} confirmations`,
                        ),
                    );

                    await tx.in.wait();

                    while (true) {
                        try {
                            console.log(
                                `[${printChain(
                                    gateway.params.from.chain,
                                )}⇢${printChain(
                                    gateway.params.to.chain,
                                )}][${tx.hash.slice(
                                    0,
                                    6,
                                )}]: Submitting to RenVM`,
                            );
                            tx.renVM.eventEmitter.on("progress", (progress) =>
                                console.log(
                                    `[${printChain(
                                        gateway.params.from.chain,
                                    )}⇢${printChain(
                                        gateway.params.to.chain,
                                    )}][${tx.hash.slice(
                                        0,
                                        6,
                                    )}]: RenVM status: ${
                                        progress.response?.txStatus
                                    }`,
                                ),
                            );
                            await tx.renVM.submit();
                            await tx.renVM.wait();
                            break;
                        } catch (error: unknown) {
                            console.error(error);
                            await utils.sleep(10 * utils.sleep.SECONDS);
                        }
                    }
                    console.log(
                        `[${printChain(gateway.fromChain.chain)}⇢${printChain(
                            gateway.toChain.chain,
                        )}][${tx.hash.slice(0, 6)}]: Submitting to ${printChain(
                            gateway.toChain.chain,
                            {
                                pad: false,
                            },
                        )}`,
                    );

                    tx.out.eventEmitter.on("progress", (progress) =>
                        console.log(
                            `[${printChain(
                                gateway.params.from.chain,
                            )}⇢${printChain(
                                gateway.params.to.chain,
                            )}][${tx.hash.slice(0, 6)}]`,
                            progress,
                        ),
                    );

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
