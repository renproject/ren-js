import chai from "chai";
import { config as loadDotEnv } from "dotenv";
import { Goerli } from "packages/chains/chains/src";
import { GatewayParams } from "packages/ren/src/params";

import { BitcoinCash } from "../packages/chains/chains-bitcoin/src";
import { Ethereum } from "../packages/chains/chains-ethereum/src";
import RenJS from "../packages/ren/src";
import { RenNetwork, utils } from "../packages/utils/src";
import { getEVMProvider, printChain, sendFunds } from "./testUtils";

chai.should();

loadDotEnv();

describe("BCH/toEthereum", () => {
    it("BCH/toEthereum", async function () {
        this.timeout(100000000000);

        const network = RenNetwork.Testnet;
        const asset = BitcoinCash.assets.BCH;
        const from = new BitcoinCash({ network });
        const to = new Ethereum({
            network,
            ...getEVMProvider(Ethereum, network),
        });

        const renJS = new RenJS(network).withChains(from, to);

        const gatewayParams: GatewayParams = {
            asset,
            from: from.Transaction({
                txidFormatted:
                    "41b46049c6f3c8503a25b009995bb2934325c1ef46f906189df0f5741c58dbb4",
                txindex: "0",
            }),
            to: to.Account(),
            nonce: 7,
        };
        const fees = await renJS.getFees(gatewayParams);
        console.log(fees);

        const gateway = await renJS.gateway(gatewayParams);

        const minimumAmount = gateway.fees.minimumAmount.shiftedBy(
            -(await from.assetDecimals(asset)),
        );
        const receivedAmount = gateway.fees
            .estimateOutput(gateway.fees.minimumAmount)
            .shiftedBy(-(await from.assetDecimals(asset)));

        for (const setupKey of Object.keys(gateway.inSetup)) {
            const setup = gateway.inSetup[setupKey];
            console.log(
                `[${printChain(gateway.fromChain.chain)}⇢${printChain(
                    gateway.toChain.chain,
                )}]: Calling ${setupKey} setup for ${String(setup.chain)}`,
            );
            setup.eventEmitter.on("progress", console.log);
            await utils.tryNTimes(async () => await setup.submit(), 2);
            await utils.tryNTimes(async () => await setup.wait(), 2);
        }

        if (gateway.in) {
            console.log(
                `[${printChain(gateway.params.from.chain)}⇢${printChain(
                    gateway.params.to.chain,
                )}]: Submitting to ${printChain(gateway.params.from.chain, {
                    pad: false,
                })}`,
            );

            gateway.in.eventEmitter.on("progress", console.log);
            await utils.tryIndefinitely(async () => await gateway.in.submit());
            // Wait for just 1 transaction for now - tx.in.wait() is called below.
            await utils.tryIndefinitely(async () => await gateway.in.wait(1));
        } else {
            console.log(
                `Deposit at least ${minimumAmount.toFixed()} ${asset} to ${
                    gateway.gatewayAddress
                } (to receive at least ${receivedAmount.toFixed()})`,
            );
            const SEND_FUNDS = false;
            if (SEND_FUNDS) {
                try {
                    await sendFunds(
                        asset,
                        gateway.gatewayAddress,
                        minimumAmount.times(5),
                    );
                } catch (error) {
                    // console.log(error.request);
                    // console.log(error.response);
                    throw error;
                }
            } else {
                console.log("Waiting for deposit...");
            }
        }

        let foundDeposits = 0;

        await new Promise<void>((resolve, reject) => {
            gateway.on("transaction", (tx) => {
                (async () => {
                    foundDeposits += 1;
                    console.log(tx.in.progress.transaction);

                    console.log(
                        `[${printChain(from.chain)}⇢${printChain(to.chain)}][${
                            tx.hash
                        }] Detected:`,
                        tx.in.progress.transaction?.txidFormatted,
                    );

                    tx.in.eventEmitter.on("progress", (progress) =>
                        console.log(
                            `[${printChain(tx.in.chain)}⇢${printChain(
                                tx.out.chain,
                            )}][${tx.hash.slice(0, 6)}]: ${
                                progress.confirmations || 0
                            }/${progress.target} confirmations`,
                        ),
                    );

                    await tx.in.wait();

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
                        `[${printChain(tx.in.chain)}⇢${printChain(
                            tx.out.chain,
                        )}][${tx.hash.slice(0, 6)}]: Submitting to ${printChain(
                            tx.out.chain,
                            {
                                pad: false,
                            },
                        )}`,
                    );

                    tx.out.eventEmitter.on("progress", console.log);

                    for (const setupKey of Object.keys(tx.outSetup)) {
                        const setup = tx.outSetup[setupKey];
                        console.log(
                            `[${printChain(
                                gateway.fromChain.chain,
                            )}⇢${printChain(
                                gateway.toChain.chain,
                            )}]: Calling ${setupKey} setup for ${String(
                                setup.chain,
                            )}`,
                        );
                        setup.eventEmitter.on("progress", console.log);
                        await setup.submit();
                        await setup.wait();
                    }

                    if (tx.out.submit) {
                        await tx.out.submit();
                    }

                    await tx.out.wait();

                    foundDeposits -= 1;

                    console.log(
                        `[${printChain(from.chain)}⇢${printChain(
                            to.chain,
                        )}][${tx.hash.slice(
                            0,
                            6,
                        )}] Done. (${foundDeposits} other deposits remaining)`,
                        tx.out.progress.transaction?.txidFormatted,
                    );
                    if (foundDeposits === 0) {
                        resolve();
                    }
                })().catch(reject);
            });
        });
    });
});
