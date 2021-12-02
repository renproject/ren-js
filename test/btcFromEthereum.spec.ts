/* eslint-disable no-console */

import chai from "chai";
import { config as loadDotEnv } from "dotenv";

import { RenNetwork, SECONDS, sleep } from "@renproject/utils/src";

import { Bitcoin } from "../packages/chains/chains-bitcoin/src";
import { Ethereum } from "../packages/chains/chains-ethereum/src";
import RenJS from "../packages/ren/src";
import { getEVMProvider, printChain } from "./testUtils";

chai.should();

loadDotEnv();

describe("RenJS Gateway Transaction", () => {
    it("BTC/fromBinanceSmartChain", async function () {
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
            from: ethereum.Account({ amount: 0.0005, convertToWei: true }),
            to: bitcoin.Address("miMi2VET41YV1j6SDNTeZoPBbmH8B4nEx6"),
        });

        console.log(
            `${gateway.params.asset} balance on ${gateway.params.from.chain}`,
            (await ethereum.getBalance(gateway.params.asset))
                .shiftedBy(-bitcoin.assetDecimals(asset))
                .toFixed(),
        );

        for (const setupKey of Object.keys(gateway.setup)) {
            const setup = gateway.setup[setupKey];
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
        gateway.in.eventEmitter.on("status", (status) =>
            console.log(
                `[${printChain(gateway.params.from.chain)}⇢${printChain(
                    gateway.params.to.chain,
                )}]: ${status.confirmations || 0}/${
                    status.target
                } confirmations`,
            ),
        );

        await gateway.in.submit();

        // Wait for just 1 transaction for now - tx.in.wait() is called below.
        await gateway.in.wait(1);

        await new Promise<void>((resolve, reject) => {
            gateway.on("transaction", (tx) => {
                (async () => {
                    console.log(
                        `[${printChain(tx.params.fromTx.chain)}⇢${printChain(
                            tx.params.to.chain,
                        )}]: RenVM hash: ${tx.hash}`,
                    );
                    await tx.fetchStatus();

                    console.log(
                        `[${printChain(tx.params.fromTx.chain)}⇢${printChain(
                            tx.params.to.chain,
                        )}][${tx.hash.slice(0, 6)}]: Status: ${tx.status}`,
                    );

                    await tx.in.wait();

                    console.log(
                        `[${printChain(tx.params.fromTx.chain)}⇢${printChain(
                            tx.params.to.chain,
                        )}][${tx.hash.slice(0, 6)}]: Submitting to RenVM`,
                    );

                    while (true) {
                        try {
                            tx.renVM.eventEmitter.on("status", console.log);
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
                        `[${printChain(tx.params.fromTx.chain)}⇢${printChain(
                            tx.params.to.chain,
                        )}][${tx.hash.slice(0, 6)}]: Submitting to ${printChain(
                            tx.params.to.chain,
                        )}`,
                    );

                    tx.out.eventEmitter.on("status", console.log);

                    if (tx.out.submit) {
                        await tx.out.submit({
                            txConfig: {},
                        });
                    }

                    await tx.out.wait();

                    resolve();
                })().catch(reject);
            });
        });
    });
});
