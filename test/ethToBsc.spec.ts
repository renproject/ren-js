/* eslint-disable no-console */

import chai from "chai";
import { config as loadDotEnv } from "dotenv";

import { Goerli, Ethereum } from "../packages/chains/chains-ethereum/src";
import RenJS from "../packages/ren/src";
import { RenNetwork, utils } from "../packages/utils/src";
import { getEVMProvider, printChain } from "./testUtils";

chai.should();

loadDotEnv();

describe.only("ETH/toGoerli", () => {
    it("ETH/toGoerli", async function () {
        this.timeout(100000000000);

        const network = RenNetwork.Testnet;

        const asset = Ethereum.assets.DAI;
        const ethereum = new Ethereum({
            network,
            ...getEVMProvider(Ethereum as any, network),
        });
        const bscAlt = new Goerli({
            network,
            ...getEVMProvider(Goerli as any, network, 1),
        });

        console.log("eth address:", await ethereum.signer.getAddress());
        console.log("bsc address:", await bscAlt.signer.getAddress());

        const renJS = new RenJS(network).withChains(bscAlt, ethereum);

        const gateway = await renJS.gateway({
            asset,
            from: ethereum.Account({ amount: 0.011, convertToWei: true }),
            to: bscAlt.Address({
                address: "0x0000000000000000000000000000000000000000",
            }),
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
                            console.log(`Submitting to RenVM`);
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
