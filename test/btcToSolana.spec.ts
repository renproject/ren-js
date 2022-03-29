import chai from "chai";
import { config as loadDotEnv } from "dotenv";

import { Connection } from "@solana/web3.js";

import { Bitcoin } from "../packages/chains/chains-bitcoin/src";
import { makeTestSigner } from "../packages/chains/chains-solana/build/main/utils";
import { Solana } from "../packages/chains/chains-solana/src";
import { renTestnet } from "../packages/chains/chains-solana/src/networks";
import RenJS from "../packages/ren/src";
import { RenNetwork, utils } from "../packages/utils/src";
import { printChain, sendFunds } from "./testUtils";
import { txHashToChainTransaction } from "@renproject/chains-ethereum/src/utils/generic";
import { ChainTransactionStatus } from "packages/utils/build/main";

chai.should();

loadDotEnv();
txHashToChainTransaction;

describe("BTC/toSolana", () => {
    it("BTC/toSolana", async function () {
        this.timeout(100000000000);

        const network = RenNetwork.Testnet;
        const asset = Bitcoin.assets.BTC;
        const from = new Bitcoin({ network });
        const to = new Solana({
            network: renTestnet,
            provider: new Connection(renTestnet.endpoint),
            signer: makeTestSigner(
                Buffer.from(process.env.TESTNET_SOLANA_KEY, "hex"),
            ),
        });

        const renJS = new RenJS(network).withChains(from, to);

        const gateway = await renJS.gateway({
            asset,
            from: from.GatewayAddress(),
            to: to.Account(),
            nonce: 7,
        });

        const decimals = from.assetDecimals(asset);

        const minimumAmount = gateway.fees.minimumAmount.shiftedBy(-decimals);
        const receivedAmount = gateway.fees
            .estimateOutput(gateway.fees.minimumAmount)
            .shiftedBy(-decimals);

        console.log(
            `Deposit at least ${minimumAmount.toFixed()} ${asset} to ${
                gateway.gatewayAddress
            } (to receive at least ${receivedAmount.toFixed()})`,
        );

        for (const setupKey of Object.keys(gateway.inSetup)) {
            const setup = gateway.inSetup[setupKey];
            console.log(
                `[${printChain(gateway.fromChain.chain)}⇢${printChain(
                    gateway.toChain.chain,
                )}]: Calling ${setupKey} setup for ${String(setup.chain)}`,
            );
            setup.eventEmitter.on("progress", console.log);
            await setup.submit();
            await setup.wait();
        }

        const SEND_FUNDS = false;
        if (SEND_FUNDS) {
            await sendFunds(
                asset,
                gateway.gatewayAddress,
                minimumAmount.times(5),
            );
        } else {
            console.log("Waiting for deposit...");
        }

        let foundDeposits = 0;

        await new Promise<void>((resolve, reject) => {
            gateway.on("transaction", (tx) => {
                (async () => {
                    foundDeposits += 1;

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

                    while (true) {
                        try {
                            await tx.in.wait();
                            break;
                        } catch (error: unknown) {
                            console.error(error);
                            await utils.sleep(10 * utils.sleep.SECONDS);
                        }
                    }

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
                            if (
                                tx.renVM.progress.status ===
                                ChainTransactionStatus.Reverted
                            ) {
                                return;
                            }
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
                        console.log(`Calling submit.`);
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
