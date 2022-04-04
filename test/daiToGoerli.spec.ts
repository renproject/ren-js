/* eslint-disable no-console */

import chai from "chai";
import { config as loadDotEnv } from "dotenv";

import { BinanceSmartChain, Ethereum } from "@renproject/chains-ethereum/src";
import { RenNetwork, utils } from "@renproject/utils/src";

import RenJS from "../packages/ren/src";
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
            ...getEVMProvider(BinanceSmartChain as any, network, 1),
        });

        console.log(
            `${ethereum.chain} address:`,
            await ethereum.signer.getAddress(),
        );
        console.log(`${bsc.chain} address:`, await bsc.signer.getAddress());

        const renJS = new RenJS(network).withChains(bsc, ethereum);

        const gateway = await renJS.gateway({
            asset,
            from: bsc.Account({ amount: 0.01, convertUnit: true }),
            to: ethereum.Account(),
            // from: ethereum.Account({ amount: 0.02, convertUnit: true }),
            // to: bsc.Address("0x0000000000000000000000000000000000000001"),
        });

        const balance = await ethereum.getBalance(gateway.params.asset);
        console.log(
            `${gateway.params.asset} balance on ${gateway.params.from.chain}`,
            balance.shiftedBy(-18).toFixed(),
        );

        // Check what set-up calls need to be made
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

        const minimumAmount = gateway.fees.minimumAmount.shiftedBy(
            -(await ethereum.assetDecimals(asset)),
        );

        if (balance.lt(gateway.fees.minimumAmount)) {
            throw new Error(
                `Insufficient balance. Account: ${await ethereum.signer.getAddress()}`,
            );
        }

        console.log(
            `[${printChain(gateway.params.from.chain)}⇢${printChain(
                gateway.params.to.chain,
            )}]: Submitting to ${printChain(gateway.params.from.chain, {
                pad: false,
            })} - locking ${minimumAmount.toFixed()} ${asset}`,
        );

        gateway.in.eventEmitter.on("progress", console.log);
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
                        `[${printChain(gateway.params.from.chain)}⇢${printChain(
                            gateway.params.to.chain,
                        )}][${tx.hash.slice(0, 6)}]: Submitting to ${printChain(
                            gateway.params.to.chain,
                            {
                                pad: false,
                            },
                        )}`,
                    );

                    tx.out.eventEmitter.on("progress", console.log);

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
