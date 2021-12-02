/* eslint-disable no-console */

import chai from "chai";
import { config as loadDotEnv } from "dotenv";

import {
    Arbitrum,
    Avalanche,
    BinanceSmartChain,
    Ethereum,
    Fantom,
    Goerli,
    Polygon,
} from "../packages/chains/chains-ethereum/src";
import RenJS from "../packages/ren/src";
import { RenNetwork, SECONDS, sleep } from "../packages/utils/src";
import { getEVMProvider, printChain } from "./testUtils";

chai.should();

loadDotEnv();

const randomElement = <T>(array: T[]): T =>
    array[Math.floor(Math.random() * array.length)];

describe.only("RenJS Gateway Transaction", () => {
    it("Random H2H", async function () {
        this.timeout(100000000000);

        const network = RenNetwork.Mainnet;

        const ethereum = new Ethereum(
            network,
            getEVMProvider(Ethereum, network),
        );
        const bsc = new BinanceSmartChain(
            network,
            getEVMProvider(BinanceSmartChain, network),
        );
        const arbitrum = new Arbitrum(
            network,
            getEVMProvider(Arbitrum, network),
        );
        const avalanche = new Avalanche(
            network,
            getEVMProvider(Avalanche, network),
        );
        const fantom = new Fantom(network, getEVMProvider(Fantom, network));
        const polygon = new Polygon(network, getEVMProvider(Polygon, network));

        const chains = [
            ethereum,
            bsc,
            arbitrum,
            avalanche,
            fantom,
            polygon,
        ];

        const renJS = new RenJS(network).withChains(...chains);

        console.log("address:", await ethereum.signer.getAddress());

        console.log("{");
        console.log('\tsymbol: "' + "BNB" + '",');
        console.log('\tdecimals: "' + (await ethereum.assetDecimals("BNB")).toFixed() + '",');
        console.log('\ttoken: "' + await ethereum.getRenAsset("BNB") + '",');
        console.log('\tgateway: "' + await ethereum.getMintGateway("BNB") + '",');
        console.log("},");

        console.log("{");
        console.log('\tsymbol: "' + "ETH" + '",');
        console.log('\tdecimals: "' + (await bsc.assetDecimals("ETH")).toFixed() + '",');
        console.log('\ttoken: "' + await bsc.getRenAsset("ETH") + '",');
        console.log('\tgateway: "' + await bsc.getMintGateway("ETH") + '",');
        console.log("},");

        console.log("{");
        console.log('\tsymbol: "' + "DAI" + '",');
        console.log('\tdecimals: "' + (await bsc.assetDecimals("DAI")).toFixed() + '",');
        console.log('\ttoken: "' + await bsc.getRenAsset("DAI") + '",');
        console.log('\tgateway: "' + await bsc.getMintGateway("DAI") + '",');
        console.log("},");

        console.log("{");
        console.log('\tsymbol: "' + "REN" + '",');
        console.log('\tdecimals: "' + (await bsc.assetDecimals("REN")).toFixed() + '",');
        console.log('\ttoken: "' + await bsc.getRenAsset("REN") + '",');
        console.log('\tgateway: "' + await bsc.getMintGateway("REN") + '",');
        console.log("},");

        console.log("{");
        console.log('\tsymbol: "' + "USDC" + '",');
        console.log('\tdecimals: "' + (await bsc.assetDecimals("USDC")).toFixed() + '",');
        console.log('\ttoken: "' + await bsc.getRenAsset("USDC") + '",');
        console.log('\tgateway: "' + await bsc.getMintGateway("USDC") + '",');
        console.log("},");

        console.log("{");
        console.log('\tsymbol: "' + "USDT" + '",');
        console.log('\tdecimals: "' + (await bsc.assetDecimals("USDT")).toFixed() + '",');
        console.log('\ttoken: "' + await bsc.getRenAsset("USDT") + '",');
        console.log('\tgateway: "' + await bsc.getMintGateway("USDT") + '",');
        console.log("},");

        console.log("{");
        console.log('\tsymbol: "' + "EURT" + '",');
        console.log('\tdecimals: "' + (await bsc.assetDecimals("EURT")).toFixed() + '",');
        console.log('\ttoken: "' + await bsc.getRenAsset("EURT") + '",');
        console.log('\tgateway: "' + await bsc.getMintGateway("EURT") + '",');
        console.log("},");

        console.log("{");
        console.log('\tsymbol: "' + "BUSD" + '",');
        console.log('\tdecimals: "' + (await bsc.assetDecimals("BUSD")).toFixed() + '",');
        console.log('\ttoken: "' + await bsc.getRenAsset("BUSD") + '",');
        console.log('\tgateway: "' + await bsc.getMintGateway("BUSD") + '",');
        console.log("},");

        console.log("{");
        console.log('\tsymbol: "' + "MIM" + '",');
        console.log('\tdecimals: "' + (await bsc.assetDecimals("MIM")).toFixed() + '",');
        console.log('\ttoken: "' + await bsc.getRenAsset("MIM") + '",');
        console.log('\tgateway: "' + await bsc.getMintGateway("MIM") + '",');
        console.log("},");

        console.log("{");
        console.log('\tsymbol: "' + "CRV" + '",');
        console.log('\tdecimals: "' + (await bsc.assetDecimals("CRV")).toFixed() + '",');
        console.log('\ttoken: "' + await bsc.getRenAsset("CRV") + '",');
        console.log('\tgateway: "' + await bsc.getMintGateway("CRV") + '",');
        console.log("},");

        console.log("{");
        console.log('\tsymbol: "' + "LINK" + '",');
        console.log('\tdecimals: "' + (await bsc.assetDecimals("LINK")).toFixed() + '",');
        console.log('\ttoken: "' + await bsc.getRenAsset("LINK") + '",');
        console.log('\tgateway: "' + await bsc.getMintGateway("LINK") + '",');
        console.log("},");

        console.log("{");
        console.log('\tsymbol: "' + "UNI" + '",');
        console.log('\tdecimals: "' + (await bsc.assetDecimals("UNI")).toFixed() + '",');
        console.log('\ttoken: "' + await bsc.getRenAsset("UNI") + '",');
        console.log('\tgateway: "' + await bsc.getMintGateway("UNI") + '",');
        console.log("},");

        console.log("{");
        console.log('\tsymbol: "' + "SUSHI" + '",');
        console.log('\tdecimals: "' + (await bsc.assetDecimals("SUSHI")).toFixed() + '",');
        console.log('\ttoken: "' + await bsc.getRenAsset("SUSHI") + '",');
        console.log('\tgateway: "' + await bsc.getMintGateway("SUSHI") + '",');
        console.log("},");

        console.log("{");
        console.log('\tsymbol: "' + "FTT" + '",');
        console.log('\tdecimals: "' + (await bsc.assetDecimals("FTT")).toFixed() + '",');
        console.log('\ttoken: "' + await bsc.getRenAsset("FTT") + '",');
        console.log('\tgateway: "' + await bsc.getMintGateway("FTT") + '",');
        console.log("},");

        console.log("{");
        console.log('\tsymbol: "' + "ROOK" + '",');
        console.log('\tdecimals: "' + (await bsc.assetDecimals("ROOK")).toFixed() + '",');
        console.log('\ttoken: "' + await bsc.getRenAsset("ROOK") + '",');
        console.log('\tgateway: "' + await bsc.getMintGateway("ROOK") + '",');
        console.log("},");

        console.log("{");
        console.log('\tsymbol: "' + "BADGER" + '",');
        console.log('\tdecimals: "' + (await bsc.assetDecimals("BADGER")).toFixed() + '",');
        console.log('\ttoken: "' + await bsc.getRenAsset("BADGER") + '",');
        console.log('\tgateway: "' + await bsc.getMintGateway("BADGER") + '",');
        console.log("},");

        console.log("{");
        console.log('\tsymbol: "' + "KNC" + '",');
        console.log('\tdecimals: "' + (await bsc.assetDecimals("KNC")).toFixed() + '",');
        console.log('\ttoken: "' + await bsc.getRenAsset("KNC") + '",');
        console.log('\tgateway: "' + await bsc.getMintGateway("KNC") + '",');
        console.log("},");

        console.log("{");
        console.log('\tsymbol: "' + "AVAX" + '",');
        console.log('\tdecimals: "' + (await bsc.assetDecimals("AVAX")).toFixed() + '",');
        console.log('\ttoken: "' + await bsc.getRenAsset("AVAX") + '",');
        console.log('\tgateway: "' + await bsc.getMintGateway("AVAX") + '",');
        console.log("},");

        console.log("{");
        console.log('\tsymbol: "' + "ArbETH" + '",');
        console.log('\tdecimals: "' + (await bsc.assetDecimals("ArbETH")).toFixed() + '",');
        console.log('\ttoken: "' + await bsc.getRenAsset("ArbETH") + '",');
        console.log('\tgateway: "' + await bsc.getMintGateway("ArbETH") + '",');
        console.log("},");

        console.log("{");
        console.log('\tsymbol: "' + "FTM" + '",');
        console.log('\tdecimals: "' + (await bsc.assetDecimals("FTM")).toFixed() + '",');
        console.log('\ttoken: "' + await bsc.getRenAsset("FTM") + '",');
        console.log('\tgateway: "' + await bsc.getMintGateway("FTM") + '",');
        console.log("},");

        console.log("{");
        console.log('\tsymbol: "' + "MATIC" + '",');
        console.log('\tdecimals: "' + (await bsc.assetDecimals("MATIC")).toFixed() + '",');
        console.log('\ttoken: "' + await bsc.getRenAsset("MATIC") + '",');
        console.log('\tgateway: "' + await bsc.getMintGateway("MATIC") + '",');
        console.log("},");

        return;

        while (true) {
            try {
                const from = randomElement(chains);
                const to = randomElement(
                    chains.filter((chain) => chain.chain !== from.chain),
                );

                await to.getMintGateway("BTC");

                const asset = randomElement(Object.values(from.assets));

                const fromBalance = await from.getBalance(asset);
                const assetDecimals = await from.assetDecimals(asset);

                const amount = fromBalance.dividedBy(10).integerValue();

                if (amount.isZero()) {
                    console.log(
                        `Skipping ${asset} from ${from.chain} to ${to.chain}.`,
                    );
                    continue;
                }

                console.log(
                    `Moving ${amount
                        .shiftedBy(-assetDecimals)
                        .toFixed()}${asset} from ${from.chain} to ${to.chain}`,
                );

                const gateway = await renJS.gateway({
                    asset,
                    from: from.Account({ amount }),
                    to: to.Account(),
                });

                // Check what set-up calls need to be made
                for (const setupKey of Object.keys(gateway.setup)) {
                    const setup = gateway.setup[setupKey];
                    console.log(
                        `[${printChain(gateway.params.from.chain)}⇢${printChain(
                            gateway.params.to.chain,
                        )}]: Calling ${setupKey} setup for ${String(
                            setup.chain,
                        )}`,
                    );
                    // setup.eventEmitter.on("status", console.log);
                    await setup.submit();
                }

                console.log(
                    `[${printChain(gateway.params.from.chain)}⇢${printChain(
                        gateway.params.to.chain,
                    )}]: Submitting to ${printChain(gateway.params.to.chain, {
                        pad: false,
                    })}`,
                );

                // gateway.in.eventEmitter.on("status", console.log);
                await gateway.in.submit();
                // Wait for just 1 transaction for now - tx.in.wait() is called below.
                await gateway.in.wait(1);

                await new Promise<void>((resolve, reject) => {
                    gateway.on("transaction", (tx) => {
                        (async () => {
                            console.log(
                                `[${printChain(
                                    gateway.params.from.chain,
                                )}⇢${printChain(
                                    gateway.params.to.chain,
                                )}]: RenVM hash: ${tx.hash}`,
                            );
                            await tx.fetchStatus();

                            console.log(
                                `[${printChain(
                                    gateway.params.from.chain,
                                )}⇢${printChain(
                                    gateway.params.to.chain,
                                )}][${tx.hash.slice(0, 6)}]: Status: ${
                                    tx.status
                                }`,
                            );

                            tx.in.eventEmitter.on("status", (status) =>
                                console.log(
                                    `[${printChain(
                                        gateway.params.from.chain,
                                    )}⇢${printChain(
                                        gateway.params.to.chain,
                                    )}][${tx.hash.slice(0, 6)}]: ${
                                        status.confirmations || 0
                                    }/${status.target} confirmations`,
                                ),
                            );

                            await tx.in.wait();

                            while (true) {
                                try {
                                    console.log(`Submitting to RenVM`);
                                    // tx.renVM.eventEmitter.on("status", console.log);
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
                                `[${printChain(
                                    gateway.params.from.chain,
                                )}⇢${printChain(
                                    gateway.params.to.chain,
                                )}][${tx.hash.slice(
                                    0,
                                    6,
                                )}]: Submitting to ${printChain(
                                    gateway.params.to.chain,
                                    {
                                        pad: false,
                                    },
                                )}`,
                            );

                            // tx.out.eventEmitter.on("status", console.log);

                            if (tx.out.submit) {
                                await tx.out.submit();
                            }

                            await tx.out.wait();

                            resolve();
                        })().catch(reject);
                    });
                });
            } catch (error) {
                console.error(error);
            }
        }
    });
});
