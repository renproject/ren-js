/* eslint-disable no-console */

import chai from "chai";
import { config as loadDotEnv } from "dotenv";

import { RenNetwork, SECONDS, sleep } from "@renproject/utils/src";

import { Bitcoin } from "../packages/chains/chains-bitcoin/src";
import { Ethereum } from "../packages/chains/chains-ethereum/src";
import RenJS from "../packages/ren/src";
import { colorizeChain, getEVMProvider } from "./testUtils";

chai.should();

loadDotEnv();

describe.only("RenJS Gateway Transaction", () => {
    it("DAI/fromBinanceSmartChain", async function () {
        this.timeout(100000000000);

        const network = RenNetwork.Testnet;

        const asset = Bitcoin.assets.BTC;
        const ethereum = new Ethereum(
            network,
            getEVMProvider(Ethereum, network),
        );
        const bitcoin = new Bitcoin(network);

        const renJS = new RenJS(network).withChains(bitcoin, ethereum);

        const gateway = await renJS.gateway({
            asset,
            from: ethereum.Account(0.0005 * 1e8),
            to: bitcoin.Address("miMi2VET41YV1j6SDNTeZoPBbmH8B4nEx6"),
        });

        console.log(
            `${gateway.params.asset} balance on ${gateway.params.from.chain}`,
            (await ethereum.getBalance(gateway.params.asset))
                .shiftedBy(-18)
                .toFixed(),
        );

        for (const setupKey of Object.keys(gateway.setup)) {
            const setup = gateway.setup[setupKey];
            console.log(
                `[${colorizeChain(gateway.params.from.chain)}⇢${colorizeChain(
                    gateway.params.to.chain,
                )}]: Calling ${setupKey} setup for ${String(setup.chain)}`,
            );
            setup.eventEmitter.on("status", console.log);
            await setup.submit();
        }

        console.log(
            `[${colorizeChain(gateway.params.from.chain)}⇢${colorizeChain(
                gateway.params.to.chain,
            )}]: Submitting to ${colorizeChain(gateway.params.to.chain, {
                pad: false,
            })}`,
        );

        gateway.in.eventEmitter.on("status", console.log);
        await gateway.in.submit({
            txConfig: {
                gasLimit: 1000000,
            },
        });

        // Wait for just 1 transaction for now - tx.in.wait() is called below.
        await gateway.in.wait(1);

        await new Promise<void>((resolve, reject) => {
            gateway.on("transaction", (tx) => {
                (async () => {
                    console.log(
                        `[${colorizeChain(
                            tx.params.fromTx.chain,
                        )}⇢${colorizeChain(tx.params.to.chain)}]: RenVM hash: ${
                            tx.hash
                        }`,
                    );
                    await tx.refreshStatus();

                    console.log(
                        `[${colorizeChain(
                            tx.params.fromTx.chain,
                        )}⇢${colorizeChain(
                            tx.params.to.chain,
                        )}][${tx.hash.slice(0, 6)}]: Status: ${tx.status}`,
                    );

                    tx.in.eventEmitter.on("status", (status) =>
                        console.log(
                            `[${colorizeChain(
                                tx.params.fromTx.chain,
                            )}⇢${colorizeChain(
                                tx.params.to.chain,
                            )}][${tx.hash.slice(0, 6)}]: ${
                                status.confirmations || 0
                            }/${status.target} confirmations`,
                        ),
                    );

                    await tx.in.wait();

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
                    console.log(
                        `[${colorizeChain(
                            tx.params.fromTx.chain,
                        )}⇢${colorizeChain(
                            tx.params.to.chain,
                        )}][${tx.hash.slice(
                            0,
                            6,
                        )}]: Submitting to ${colorizeChain(
                            tx.params.to.chain,
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
