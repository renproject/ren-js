/* eslint-disable no-console */

import chai from "chai";
import { config as loadDotEnv } from "dotenv";

import { RenNetwork } from "@renproject/utils";

import { Bitcoin } from "../packages/chains/chains-bitcoin/src";
import { Ethereum } from "../packages/chains/chains/src";
import RenJS from "../packages/ren/src";
import { getEVMProvider } from "./testUtils";

chai.should();

loadDotEnv();

describe("BTC to Ethereum", () => {
    it.only("mint", async function () {
        this.timeout(100000000000);

        const network = RenNetwork.Testnet;
        const bitcoin = new Bitcoin(network);
        const ethereum = new Ethereum(
            network,
            getEVMProvider(Ethereum, network),
        );

        const renJS = new RenJS(network).withChains(bitcoin, ethereum);

        const gateway = await renJS.gateway({
            asset: bitcoin.assets.BTC,
            from: bitcoin.GatewayAddress(),
            to: ethereum.Account(),
        });

        console.log(`Gateway address: ${gateway.gatewayAddress()}`);

        await new Promise<void>((resolve, reject) => {
            gateway.on("transaction", (tx) => {
                (async () => {
                    console.log(
                        `[${bitcoin.chain}⇢${ethereum.chain}]: RenVM hash: ${tx.hash}`,
                    );
                    await tx.refreshStatus();

                    console.log(
                        `[${bitcoin.chain}⇢${ethereum.chain}][${tx.hash.slice(
                            0,
                            6,
                        )}]: Status: ${tx.status}`,
                    );

                    // Wait for input confirmations.
                    // (Note - can subscribe to events with tx.in.eventEmitter.on instead of tx.in.wait().on)
                    await tx.in
                        .wait()
                        .on("status", (status) =>
                            console.log(
                                `[${bitcoin.chain}⇢${
                                    ethereum.chain
                                }][${tx.hash.slice(0, 6)}]: ${
                                    status.confirmations || 0
                                }/${status.target} confirmations`,
                            ),
                        );

                    // Submit to RenVM
                    await tx.renVM.submit();
                    await tx.renVM.wait();

                    console.log(
                        `[${bitcoin.chain}⇢${ethereum.chain}][${tx.hash.slice(
                            0,
                            6,
                        )}]: Submitting to ${ethereum.chain}`,
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
