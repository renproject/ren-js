/* eslint-disable no-console */

import chai from "chai";
import { blue, blueBright, cyan, green, magenta, red, yellow } from "chalk";
import { config as loadDotEnv } from "dotenv";
import throat from "throat";

import { Bitcoin } from "../../chains/chains-bitcoin/src";
import {
    Arbitrum,
    Avalanche,
    BinanceSmartChain,
    Ethereum,
    Fantom,
    Goerli,
    Polygon,
} from "../../chains/chains-ethereum/src";
import { LogLevel, RenNetwork } from "../../interfaces/src";
import RenJS from "../../ren/src";
import { SECONDS, sleep } from "../../utils/src";
import { getEVMChain } from "./testUtils";

chai.should();

loadDotEnv();

const colorizeChain = (chain: string): string => {
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
    if (chain.length > 8) {
        chain = chain.slice(0, 7) + "…";
    }
    if (chain.length < 8) {
        const difference = 8 - chain.length;
        const left = Math.floor(difference / 2);
        const right = Math.ceil(difference / 2);
        chain = " ".repeat(left) + chain + " ".repeat(right);
    }
    return color(chain);
};

describe("Refactor: mint", () => {
    it.only("mint to contract", async function () {
        this.timeout(100000000000);

        const network = RenNetwork.Testnet;
        const asset = "DAI";
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const toClass = getEVMChain(Ethereum as any, network);

        const throttle = {
            [Ethereum.chain]: throat(1),
            [Avalanche.chain]: throat(1),
            [Fantom.chain]: throat(1),
            [Goerli.chain]: throat(1),
            [Polygon.chain]: throat(1),
            [BinanceSmartChain.chain]: throat(1),
            [Arbitrum.chain]: throat(1),
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

        await Promise.all(
            fromChains.map(async (From) => {
                while (true) {
                    try {
                        const fromClass = getEVMChain(From, network);
                        // const fromClass = new From("testnet");

                        const toAddress = await toClass.signer.getAddress();
                        console.log(
                            `[${colorizeChain(
                                toClass.chain,
                            )}] Address: ${toAddress}`,
                        );

                        const from = fromClass.FromAccount(
                            "1000000000000000000",
                        );
                        // const from = fromClass;
                        const to = toClass.Address(toAddress);

                        const logLevel: LogLevel = LogLevel.Log;
                        const renJS = new RenJS(network, {
                            logLevel,
                        }).withChains(fromClass, toClass);

                        const params = {
                            asset,
                            from,
                            to,
                        };

                        const gateway = await renJS.gateway(params);

                        await throttle[fromClass.chain](async () => {
                            console.log(
                                `[${colorizeChain(
                                    fromClass.chain,
                                )}⇢${colorizeChain(
                                    toClass.chain,
                                )}]: Submitting to ${String(fromClass.chain)}`,
                            );
                            return await gateway.from.burn
                                .submit()
                                .on("transaction", console.log);
                        });

                        // console.log(
                        //     "Gateway address",
                        //     gateway.gatewayAddress(),
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
                                    await tx.in.confirmed();
                                    while (true) {
                                        try {
                                            await tx.signed();
                                            break;
                                            // eslint-disable-next-line @typescript-eslint/no-explicit-any
                                        } catch (error: any) {
                                            console.error(error);
                                            await sleep(10 * SECONDS);
                                        }
                                    }
                                    await throttle[toClass.chain](async () => {
                                        console.log(
                                            `[${colorizeChain(
                                                fromClass.chain,
                                            )}⇢${colorizeChain(
                                                toClass.chain,
                                            )}]: Submitting to ${String(
                                                toClass.chain,
                                            )}`,
                                        );
                                        return await tx.out
                                            .submit()
                                            .on("transaction", console.log);
                                    });
                                    resolve();
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
