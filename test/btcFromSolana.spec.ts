/* eslint-disable no-console */

import chai from "chai";
import { config as loadDotEnv } from "dotenv";

import { RenNetwork, utils } from "@renproject/utils/src";
import { Connection } from "@solana/web3.js";

import { Bitcoin } from "../packages/chains/chains-bitcoin/src";
import { Solana } from "../packages/chains/chains-solana/src";
import RenJS from "../packages/ren/src";
import { printChain } from "./testUtils";
import { renTestnet } from "../packages/chains/chains-solana/src/networks";
import { makeTestSigner } from "../packages/chains/chains-solana/src/utils";

chai.should();

loadDotEnv();

describe("BTC/fromSolana", () => {
    it("BTC/fromSolana", async function () {
        this.timeout(100000000000);

        const network = RenNetwork.Testnet;

        const asset = Bitcoin.assets.BTC;
        const solana = new Solana({
            network,
            provider: new Connection(renTestnet.endpoint),
            signer: makeTestSigner(
                Buffer.from(process.env.TESTNET_SOLANA_KEY, "hex"),
            ),
        });
        const bitcoin = new Bitcoin({ network });

        const renJS = new RenJS(network).withChains(bitcoin, solana);

        const from = solana;
        const to = bitcoin;

        const decimals = await to.assetDecimals(asset);

        const fees = await renJS.getFees({
            asset,
            from,
            to,
        });

        const minimumAmount = fees.minimumAmount;
        const amount = minimumAmount.times(2);

        const gateway = await renJS.gateway({
            asset,
            from: from.Account({
                amount: amount.shiftedBy(-decimals),
                convertUnit: true,
            }),
            to: to.Address("miMi2VET41YV1j6SDNTeZoPBbmH8B4nEx6"),
        });

        console.log(
            `[${printChain(gateway.params.from.chain)}⇢${printChain(
                gateway.params.to.chain,
            )}]: Sending ${amount.shiftedBy(-decimals).toFixed()} ${asset}`,
        );

        console.log(
            `[${printChain(gateway.params.from.chain)}⇢${printChain(
                gateway.params.to.chain,
            )}]: ${gateway.params.asset} balance on ${
                gateway.params.from.chain
            }`,
            (await from.getBalance(gateway.params.asset))
                .shiftedBy(decimals)
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
                        } catch (error: unknown) {
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
