/* eslint-disable no-console */

import chai from "chai";
import { blue, blueBright, cyan, green, magenta, red, yellow } from "chalk";
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
import { SECONDS, sleep } from "@renproject/utils/src";

import { Bitcoin } from "../packages/chains/chains-bitcoin/src";
import RenJS from "../packages/ren/src";
import { GatewayParams } from "../packages/ren/src/params";
import { getEVMChain } from "./testUtils";

chai.should();

loadDotEnv();

const colorizeChain = (chain: string, { pad } = { pad: true }): string => {
    const color =
        chain === "Ethereum"
            ? blue
            : chain === "Solana"
            ? magenta
            : chain === "BinanceSmartChain"
            ? yellow
            : chain === "Fantom"
            ? blueBright
            : chain === "Polygon"
            ? magenta
            : chain === "Avalanche"
            ? red
            : chain === "Goerli"
            ? green
            : cyan;
    if (pad) {
        if (chain.length > 8) {
            chain = chain.slice(0, 7) + "…";
        }
        if (chain.length < 8) {
            const difference = 8 - chain.length;
            const left = Math.floor(difference / 2);
            const right = Math.ceil(difference / 2);
            chain = " ".repeat(left) + chain + " ".repeat(right);
        }
    }
    return color(chain);
};

describe("Refactor: mint", () => {
    it("mint to contract", async function () {
        this.timeout(100000000000);

        const network = RenNetwork.Testnet;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const toClass = getEVMChain(Ethereum as any, network);

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
                        const fromClass = new From(
                            network,
                            getEVMChain(From, network),
                        );
                        // const fromClass = new From("testnet");

                        const toAddress = await toClass.signer.getAddress();
                        console.log(
                            `[${colorizeChain(
                                toClass.chain,
                            )}] Address: ${toAddress}`,
                        );

                        const from = fromClass.Account("1000000000000000000");
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

                        for (const setupKey of Object.keys(gateway.setup)) {
                            const setup = gateway.setup[setupKey];
                            await throttles[setup.chain](async () => {
                                console.log(
                                    `[${colorizeChain(
                                        fromClass.chain,
                                    )}⇢${colorizeChain(
                                        toClass.chain,
                                    )}]: Calling ${setupKey} setup for ${String(
                                        setup.chain,
                                    )}`,
                                );
                                setup.eventEmitter.on("status", console.log);
                                return await setup.submit();
                            });
                        }

                        await throttles[fromClass.chain](async () => {
                            console.log(
                                `[${colorizeChain(
                                    fromClass.chain,
                                )}⇢${colorizeChain(
                                    toClass.chain,
                                )}]: Submitting to ${String(fromClass.chain)}`,
                            );
                            gateway.in.eventEmitter.on("status", console.log);
                            await gateway.in.submit({
                                config: { gasLimit: 2000000 },
                            });
                            await gateway.in.wait();
                        });

                        // console.log(
                        //     `[${colorizeChain(toClass.chain)}] ${colorizeChain(
                        //         fromClass.chain,
                        //         { pad: false },
                        //     )} Gateway address: ${gateway.gatewayAddress()}`,
                        // );

                        await new Promise<void>((resolve, reject) => {
                            gateway.on("transaction", (tx) => {
                                (async () => {
                                    console.log(
                                        `[${colorizeChain(
                                            fromClass.chain,
                                        )}⇢${colorizeChain(
                                            toClass.chain,
                                        )}]: RenVM hash: ${tx.hash}`,
                                    );
                                    await tx.refreshStatus();

                                    console.log(
                                        `[${colorizeChain(
                                            fromClass.chain,
                                        )}⇢${colorizeChain(
                                            toClass.chain,
                                        )}][${tx.hash.slice(0, 6)}]: Status: ${
                                            tx.status
                                        }`,
                                    );

                                    tx.in.eventEmitter.on("status", (status) =>
                                        console.log(
                                            `[${colorizeChain(
                                                fromClass.chain,
                                            )}⇢${colorizeChain(
                                                toClass.chain,
                                            )}][${tx.hash.slice(0, 6)}]: ${
                                                status.confirmations || 0
                                            }/${status.target} confirmations`,
                                        ),
                                    );

                                    await tx.in.wait();
                                    // .on("target", (target) =>
                                    //     console.log(
                                    //         `[${colorizeChain(
                                    //             fromClass.chain,
                                    //         )}⇢${colorizeChain(
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
                                    //             `[${colorizeChain(
                                    //                 fromClass.chain,
                                    //             )}⇢${colorizeChain(
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
                                            await sleep(10 * SECONDS);
                                        }
                                    }
                                    await throttles[toClass.chain](async () => {
                                        console.log(
                                            `[${colorizeChain(
                                                fromClass.chain,
                                            )}⇢${colorizeChain(
                                                toClass.chain,
                                            )}][${tx.hash.slice(
                                                0,
                                                6,
                                            )}]: Submitting to ${colorizeChain(
                                                toClass.chain,
                                            )}`,
                                        );

                                        tx.out.eventEmitter.on(
                                            "status",
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
