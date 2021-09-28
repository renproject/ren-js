/* eslint-disable no-console */

import chai from "chai";
import { blue, blueBright, cyan, green, magenta, red, yellow } from "chalk";
import { config as loadDotEnv } from "dotenv";
import throat from "throat";

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
        const toClass = getEVMChain(Ethereum as any, network);

        const throttle = {
            [Ethereum.name]: throat(1),
            [Avalanche.name]: throat(1),
            [Fantom.name]: throat(1),
            [Goerli.name]: throat(1),
            [Polygon.name]: throat(1),
            [BinanceSmartChain.name]: throat(1),
            [Arbitrum.name]: throat(1),
        };

        const fromChains = [
            // Avalanche,
            // Fantom,
            // Goerli,
            // Polygon,
            BinanceSmartChain,
            // Arbitrum,
        ];

        await Promise.all(
            fromChains.map(async (From) => {
                while (true) {
                    try {
                        const fromClass = getEVMChain(From as any, network);

                        const toAddress = await toClass.signer.getAddress();
                        console.log(
                            `[${colorizeChain(
                                toClass.name,
                            )}] Address: ${toAddress}`,
                        );

                        const from = fromClass.FromAccount(
                            "1000000000000000000",
                        );
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

                        await throttle[fromClass.name](async () => {
                            console.log(
                                `[${colorizeChain(
                                    fromClass.name,
                                )}⇢${colorizeChain(
                                    toClass.name,
                                )}]: Submitting to ${fromClass.name}`,
                            );
                            return await gateway.from.burn
                                .submit()
                                .on("transaction", console.log);
                        });

                        await new Promise<void>((resolve, reject) => {
                            gateway.on("transaction", (tx) => {
                                (async () => {
                                    console.log(
                                        `[${colorizeChain(
                                            fromClass.name,
                                        )}⇢${colorizeChain(
                                            toClass.name,
                                        )}]: RenVM hash: ${tx.hash}`,
                                    );
                                    await tx.in.confirmed();
                                    while (true) {
                                        try {
                                            await tx.signed();
                                            break;
                                        } catch (error) {
                                            console.error(error);
                                            await sleep(10 * SECONDS);
                                        }
                                    }
                                    await throttle[toClass.name](async () => {
                                        console.log(
                                            `[${colorizeChain(
                                                fromClass.name,
                                            )}⇢${colorizeChain(
                                                toClass.name,
                                            )}]: Submitting to ${toClass.name}`,
                                        );
                                        return await tx.out
                                            .submit()
                                            .on("transaction", console.log);
                                    });
                                    resolve();
                                })().catch(reject);
                            });
                        });
                    } catch (error) {
                        console.warn(
                            `Errored for chain ${From.name}, ${From.chain}`,
                        );
                        console.error(error);
                    }
                    return;
                }
            }),
        );
    });
});
