/* eslint-disable no-console */

import chai from "chai";
import { config as loadDotEnv } from "dotenv";
import throttle from "throat";

import {
    Arbitrum,
    Avalanche,
    BinanceSmartChain,
    Ethereum,
    Fantom,
    Goerli,
    Polygon,
} from "@renproject/chains-ethereum/src";
import { LogLevel, RenNetwork } from "@renproject/utils";
import { utils } from "@renproject/utils/src";

import RenJS from "../packages/ren/src";
import { GatewayParams } from "../packages/ren/src/params";
import { getEVMProvider, printChain } from "./testUtils";

chai.should();

loadDotEnv();

describe("DAI/to*", () => {
    it("DAI/to*", async function () {
        this.timeout(100000000000);

        const network = RenNetwork.Testnet;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const toClass = new Ethereum({
            network,
            ...getEVMProvider(Ethereum as any, network),
        });

        const throttles = {
            [Ethereum.chain]: throttle(1),
            [Avalanche.chain]: throttle(1),
            [Fantom.chain]: throttle(1),
            [Goerli.chain]: throttle(1),
            [Polygon.chain]: throttle(1),
            [BinanceSmartChain.chain]: throttle(1),
            [Arbitrum.chain]: throttle(1),
        };

        const fromChains = [
            // Avalanche,
            // Fantom,
            // Goerli,
            // Polygon,
            // Bitcoin,
            // Arbitrum,
            BinanceSmartChain,
        ];

        const asset = Ethereum.assets.DAI;

        await Promise.all(
            fromChains.map(async (From) => {
                while (true) {
                    try {
                        const fromClass = new From({
                            network,
                            ...getEVMProvider(From, network),
                        });
                        // const fromClass = new From("testnet");

                        const toAddress = await toClass.signer.getAddress();
                        console.log(
                            `[${printChain(
                                toClass.chain,
                            )}] Address: ${toAddress}`,
                        );

                        const from = fromClass.Account({
                            amount: "1000000000000000000",
                        });
                        // const from = fromClass.FromAccount();
                        const to = toClass.Account();

                        const logLevel: LogLevel = LogLevel.Log;
                        const renJS = new RenJS(network, {
                            logLevel,
                        }).withChains(fromClass, toClass);

                        const params: GatewayParams = {
                            asset,
                            from,
                            to,
                        };

                        const gateway = await renJS.gateway(params);

                        console.log(
                            "balance",
                            (await fromClass.getBalance("DAI"))
                                .shiftedBy(-18)
                                .toFixed(),
                        );

                        for (const setupKey of Object.keys(gateway.inSetup)) {
                            const setup = gateway.inSetup[setupKey];
                            await throttles[setup.chain](async () => {
                                console.log(
                                    `[${printChain(
                                        fromClass.chain,
                                    )}⇢${printChain(
                                        toClass.chain,
                                    )}]: Calling ${setupKey} setup for ${String(
                                        setup.chain,
                                    )}`,
                                );
                                setup.eventEmitter.on("progress", console.log);
                                await setup.submit();
                                return await setup.wait();
                            });
                        }

                        await throttles[fromClass.chain](async () => {
                            console.log(
                                `[${printChain(fromClass.chain)}⇢${printChain(
                                    toClass.chain,
                                )}]: Submitting to ${String(fromClass.chain)}`,
                            );
                            gateway.in.eventEmitter.on("progress", console.log);
                            await gateway.in.submit({
                                txConfig: { gasLimit: 2000000 },
                            });
                            await gateway.in.wait();
                        });

                        // console.log(
                        //     `[${printChain(toClass.chain)}] ${printChain(
                        //         fromClass.chain,
                        //         { pad: false },
                        //     )} Gateway address: ${gateway.gatewayAddress()}`,
                        // );

                        await new Promise<void>((resolve, reject) => {
                            gateway.on("transaction", (tx) => {
                                (async () => {
                                    console.log(
                                        `[${printChain(
                                            fromClass.chain,
                                        )}⇢${printChain(
                                            toClass.chain,
                                        )}]: RenVM hash: ${tx.hash}`,
                                    );

                                    tx.in.eventEmitter.on(
                                        "progress",
                                        (progress) =>
                                            console.log(
                                                `[${printChain(
                                                    fromClass.chain,
                                                )}⇢${printChain(
                                                    toClass.chain,
                                                )}][${tx.hash.slice(0, 6)}]: ${
                                                    progress.confirmations || 0
                                                }/${
                                                    progress.target
                                                } confirmations`,
                                            ),
                                    );

                                    await tx.in.wait();
                                    // .on("target", (target) =>
                                    //     console.log(
                                    //         `[${printChain(
                                    //             fromClass.chain,
                                    //         )}⇢${printChain(
                                    //             toClass.chain,
                                    //         )}][${tx.hash.slice(
                                    //             0,
                                    //             6,
                                    //         )}]: Target: ${target} confirmations`,
                                    //     ),
                                    // )
                                    // .on(
                                    //     "confirmation",
                                    //     (confirmations, target) =>
                                    //         console.log(
                                    //             `[${printChain(
                                    //                 fromClass.chain,
                                    //             )}⇢${printChain(
                                    //                 toClass.chain,
                                    //             )}][${tx.hash.slice(
                                    //                 0,
                                    //                 6,
                                    //             )}]: ${confirmations}/${target} confirmations`,
                                    //         ),
                                    // );
                                    while (true) {
                                        try {
                                            await tx.renVM.submit();
                                            await tx.renVM.wait();
                                            break;
                                            // eslint-disable-next-line @typescript-eslint/no-explicit-any
                                        } catch (error: any) {
                                            console.error(error);
                                            await utils.sleep(
                                                10 * utils.sleep.SECONDS,
                                            );
                                        }
                                    }
                                    await throttles[toClass.chain](async () => {
                                        console.log(
                                            `[${printChain(
                                                fromClass.chain,
                                            )}⇢${printChain(
                                                toClass.chain,
                                            )}][${tx.hash.slice(
                                                0,
                                                6,
                                            )}]: Submitting to ${printChain(
                                                toClass.chain,
                                            )}`,
                                        );

                                        tx.out.eventEmitter.on(
                                            "progress",
                                            console.log,
                                        );

                                        if (tx.out.submit) {
                                            await tx.out.submit();
                                        }
                                    });
                                    // resolve();
                                })().catch(reject);
                            });
                        });
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    } catch (error: any) {
                        console.warn(
                            `Errored for chain ${From.chain}, ${From.chain}`,
                        );
                        console.error(error);
                    }
                    return;
                }
            }),
        );
    });
});
