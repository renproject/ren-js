import chai from "chai";
import { config as loadDotEnv } from "dotenv";

import { Bitcoin } from "../packages/chains/chains-bitcoin/src";
import { Ethereum } from "../packages/chains/chains-ethereum/src";
import RenJS from "../packages/ren/src";
import { RenNetwork } from "../packages/utils/src";
import { colorizeChain, getEVMProvider } from "./testUtils";

chai.should();

loadDotEnv();

describe("RenJS Gateway Transaction", () => {
    it("BTC/toEthereum", async function () {
        this.timeout(100000000000);

        const network = RenNetwork.Testnet;
        const asset = Bitcoin.assets.BTC;
        const bitcoin = new Bitcoin(network);
        const ethereum = new Ethereum(
            network,
            getEVMProvider(Ethereum, network),
        );

        const renJS = new RenJS(network).withChains(bitcoin, ethereum);

        const gateway = await renJS.gateway({
            asset,
            from: bitcoin.GatewayAddress(),
            to: ethereum.Account(),
        });

        const minimumAmount = gateway.fees.minimumAmount.shiftedBy(
            -bitcoin.assetDecimals(asset),
        );
        console.log(
            `Deposit at least ${minimumAmount} ${asset} to ${gateway.gatewayAddress()}`,
        );

        await new Promise<void>((resolve, reject) => {
            gateway.on("transaction", (tx) => {
                (async () => {
                    console.log(
                        `[${colorizeChain(bitcoin.chain)}⇢${colorizeChain(
                            ethereum.chain,
                        )}]: RenVM hash: ${tx.hash}`,
                    );
                    await tx.refreshStatus();

                    console.log(
                        `[${colorizeChain(bitcoin.chain)}⇢${colorizeChain(
                            ethereum.chain,
                        )}][${tx.hash.slice(0, 6)}]: Status: ${tx.status}`,
                    );

                    // Wait for input confirmations.
                    // (Note - can subscribe to events with tx.in.eventEmitter.on instead of tx.in.wait().on)
                    await tx.in
                        .wait()
                        .on("status", (status) =>
                            console.log(
                                `[${colorizeChain(
                                    bitcoin.chain,
                                )}⇢${colorizeChain(
                                    ethereum.chain,
                                )}][${tx.hash.slice(0, 6)}]: ${
                                    status.confirmations || 0
                                }/${status.target} confirmations`,
                            ),
                        );

                    // Submit to RenVM
                    await tx.renVM.submit();
                    await tx.renVM.wait();

                    console.log(
                        `[${colorizeChain(bitcoin.chain)}⇢${colorizeChain(
                            ethereum.chain,
                        )}][${tx.hash.slice(0, 6)}]: Submitting to ${
                            ethereum.chain
                        }`,
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
