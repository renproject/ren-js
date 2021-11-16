import chai from "chai";
import { config as loadDotEnv } from "dotenv";

import { Bitcoin } from "../packages/chains/chains-bitcoin/src";
import { Ethereum } from "../packages/chains/chains-ethereum/src";
import RenJS from "../packages/ren/src";
import { RenNetwork } from "../packages/utils/src";
import { getEVMProvider, printChain, sendFunds } from "./testUtils";

chai.should();

loadDotEnv();

describe("RenJS Gateway Transaction", () => {
    it("BTC/toEthereum", async function () {
        this.timeout(100000000000);

        const network = RenNetwork.Testnet;
        const asset = Bitcoin.assets.BTC;
        const from = new Bitcoin(network);
        const to = new Ethereum(network, getEVMProvider(Ethereum, network));

        const renJS = new RenJS(network).withChains(from, to);

        const gateway = await renJS.gateway({
            asset,
            from: from.GatewayAddress(),
            to: to.Account(),
            nonce: 1,
        });

        const minimumAmount = gateway.fees.minimumAmount.shiftedBy(
            -from.assetDecimals(asset),
        );
        const receivedAmount = gateway.fees
            .estimateOutput(gateway.fees.minimumAmount)
            .shiftedBy(-from.assetDecimals(asset));

        console.log(
            `Deposit at least ${minimumAmount.toFixed()} ${asset} to ${
                gateway.gatewayAddress
            } (to receive at least ${receivedAmount.toFixed()})`,
        );

        await sendFunds(asset, gateway.gatewayAddress, minimumAmount.times(5));

        let foundDeposits = 0;

        await new Promise<void>((resolve, reject) => {
            gateway.on("transaction", (tx) => {
                (async () => {
                    foundDeposits += 1;

                    await RenJS.defaultDepositHandler(tx);

                    foundDeposits -= 1;

                    console.log(
                        `[${printChain(from.chain)}⇢${printChain(
                            to.chain,
                        )}][${tx.hash.slice(
                            0,
                            6,
                        )}] Done. (${foundDeposits} other deposits remaining)`,
                    );
                    if (foundDeposits === 0) {
                        resolve();
                    }
                })().catch(reject);
            });
        });
    });
});
