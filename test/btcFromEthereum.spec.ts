/* eslint-disable no-console */

import chai from "chai";
import { config as loadDotEnv } from "dotenv";

import { RenNetwork, utils } from "@renproject/utils/src";

import { Bitcoin } from "../packages/chains/chains-bitcoin/src";
import { Ethereum } from "../packages/chains/chains-ethereum/src";
import RenJS from "../packages/ren/src";
import { getEVMProvider, printChain } from "./testUtils";

chai.should();

loadDotEnv();

describe("BTC/fromEthereum", () => {
    it("BTC/fromEthereum", async function () {
        this.timeout(100000000000);

        const network = RenNetwork.Testnet;

        const asset = Bitcoin.assets.BTC;
        const ethereum = new Ethereum({
            network,
            ...getEVMProvider(Ethereum, network),
        });
        const bitcoin = new Bitcoin({ network });

        const renJS = new RenJS(network).withChains(bitcoin, ethereum);

        const gateway = await renJS.gateway({
            asset,
            from: ethereum.Transaction({
                txidFormatted:
                    "0x36d57617c6233766d64c0c53b03847635bf6e838addf11c0350264fb8b2efb30",
            }),
            to: bitcoin.Address("miMi2VET41YV1j6SDNTeZoPBbmH8B4nEx6"),
        });

        console.log(
            `${gateway.params.asset} balance on ${gateway.params.from.chain}`,
            (await ethereum.getBalance(gateway.params.asset))
                .shiftedBy(-bitcoin.assetDecimals(asset))
                .toFixed(),
        );

        for (const setupKey of Object.keys(gateway.inSetup)) {
            const setup = gateway.inSetup[setupKey];
            console.log(
                `[${printChain(gateway.params.from.chain)}⇢${printChain(
                    gateway.params.to.chain,
                )}]: Calling ${setupKey} setup for ${String(setup.chain)}`,
            );
            setup.eventEmitter.on("progress", console.log);
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

        gateway.in.eventEmitter.on("progress", console.log);
        gateway.in.eventEmitter.on("progress", (status) =>
            console.log(
                `[${printChain(gateway.params.from.chain)}⇢${printChain(
                    gateway.params.to.chain,
                )}]: ${status.confirmations || 0}/${
                    status.target
                } confirmations`,
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
                        `[${printChain(tx.params.fromTx.chain)}⇢${printChain(
                            tx.params.to.chain,
                        )}]: RenVM hash: ${tx.hash}`,
                    );

                    await tx.in.wait();

                    console.log(
                        `[${printChain(tx.params.fromTx.chain)}⇢${printChain(
                            tx.params.to.chain,
                        )}][${tx.hash.slice(0, 6)}]: Submitting to RenVM`,
                    );

                    tx.renVM.eventEmitter.on("progress", (progress) =>
                        console.log(
                            `[${printChain(
                                gateway.params.from.chain,
                            )}⇢${printChain(
                                gateway.params.to.chain,
                            )}][${tx.hash.slice(0, 6)}]: RenVM status: ${
                                progress.response?.txStatus
                            }`,
                        ),
                    );

                    while (true) {
                        try {
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
                        `[${printChain(tx.params.fromTx.chain)}⇢${printChain(
                            tx.params.to.chain,
                        )}][${tx.hash.slice(0, 6)}]: Submitting to ${printChain(
                            tx.params.to.chain,
                        )}`,
                    );

                    tx.out.eventEmitter.on("progress", console.log);

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
