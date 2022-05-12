import { getMintGateway } from "@renproject/chains-ethereum/src/utils/gatewayRegistry";
import chai from "chai";
import { config as loadDotEnv } from "dotenv";
import { Bitcoin } from "packages/chains/chains-bitcoin/src";
import {
    Avalanche,
    BinanceSmartChain,
    Ethereum,
    Fantom,
} from "packages/chains/chains-ethereum/src";
import { Solana } from "packages/chains/chains-solana/src";
import { Terra } from "packages/chains/chains-terra/src";
import RenJS from "packages/ren/src";
import { GatewayParams } from "packages/ren/src/params";
import { RenNetwork, utils } from "packages/utils/src";

import { Dogecoin, Filecoin } from "../packages/chains/chains/src";
import { defaultGatewayHandler } from "./utils/defaultGatewayHandler";
import { initializeChain } from "./utils/testUtils";

chai.should();

loadDotEnv();

describe("Gateway", () => {
    it("burn sentry", async () => {
        const nonce = 44530;

        const { provider } = initializeChain(Ethereum, RenNetwork.Mainnet);
        const asset = "BTC";

        const gatewayAddress = await getMintGateway(
            Ethereum.configMap.mainnet,
            provider,
            asset,
        );

        const burnLogs = await provider.getLogs({
            address: gatewayAddress,
            fromBlock: 0,
            toBlock: "latest",
            topics: [
                utils.Ox(
                    utils.keccak256(
                        Buffer.from("LogBurn(bytes,uint256,uint256,bytes)"),
                    ),
                ),
                utils.Ox(utils.toNBytes(nonce, 32)),
            ],
        });
        console.log(burnLogs[0]);
    });

    it("recover solana", async function () {
        this.timeout(100000000000);

        const network = RenNetwork.Mainnet;
        const asset = Dogecoin.assets.DOGE;
        const from = initializeChain(Solana, network);
        const to = initializeChain<Dogecoin>(Dogecoin, network);
        const renJS = new RenJS(network).withChains(from, to);

        const gatewayParams: GatewayParams = {
            asset,
            from: from.Transaction({
                txidFormatted:
                    "2NEUJeqtgR95oWaKAYwCPLpH3BqS76kruZXPL1tJ51TSwuEBeyfmqmxMuvhYi4ibuNJzuqr3ETooaMhbbsgyUBJt",
            }),
            to: to.Address("A5ZfLr3zZwsEnVvJD4Z28Dr93RDCJgQSkv"),
        };

        await defaultGatewayHandler(await renJS.gateway(gatewayParams));
    });

    // it("Get fees", async function () {
    //     this.timeout(100000000000);

    //     const network = RenNetwork.Testnet;
    //     const renJS = new RenJS();

    //     const asset = "LUNA";
    //     const from = initializeChain(Terra);
    //     const to = initializeChain(Ethereum);
    //     renJS.withChains(from, to);
    //     const decimals = await from.assetDecimals(asset);

    //     const fees = await renJS.getFees({
    //         asset,
    //         from,
    //         to,
    //     });

    //     console.log(
    //         fees
    //             .estimateOutput(new BigNumber(100000).shiftedBy(decimals))
    //             .shiftedBy(-decimals)
    //             .toFixed(),
    //         asset,
    //     );
    // });

    it("DAI: Ethereum to Avalache", async function () {
        this.timeout(100000000000);

        const network = RenNetwork.Testnet;
        const renJS = new RenJS(network);

        const asset = "DAI";
        const from = initializeChain(Ethereum);
        const to = initializeChain(Avalanche);
        renJS.withChains(from, to);

        const gatewayParams: GatewayParams = {
            asset,
            from: from.Account({ amount: "1.1", convertUnit: true }),
            to: to.Account(),
        };

        console.log(
            (await renJS.getFees(gatewayParams))
                .estimateOutput({
                    amount: "1.1",
                    convertUnit: true,
                })
                .toFixed(),
        );

        await defaultGatewayHandler(await renJS.gateway(gatewayParams));
    });

    it("ETH: BSC to Ethereum", async function () {
        this.timeout(100000000000);

        const network = RenNetwork.Testnet;

        const asset = Ethereum.assets.ETH;
        const bsc = initializeChain(BinanceSmartChain);
        const ethereum = initializeChain(Ethereum);

        const renJS = new RenJS(network).withChains(bsc, ethereum);

        const gatewayParams: GatewayParams = {
            asset,
            from: bsc.Account({ amount: 0.001, convertUnit: true }),
            to: ethereum.Account(),
        };

        await defaultGatewayHandler(await renJS.gateway(gatewayParams));
    });

    it("BNB/toSolana", async function () {
        this.timeout(100000000000);

        const network = RenNetwork.Testnet;
        const asset = BinanceSmartChain.assets.BNB;
        const from = initializeChain(BinanceSmartChain);
        const to = initializeChain(Solana);
        const renJS = new RenJS(network).withChains(from, to);

        const gatewayParams: GatewayParams = {
            asset,
            from: from.Account({ amount: 0.001, convertUnit: true }),
            to: to.Account(),
        };

        await defaultGatewayHandler(await renJS.gateway(gatewayParams));
    });

    it("FIL/fromSolana", async function () {
        this.timeout(100000000000);

        const network = RenNetwork.Testnet;

        const asset = Filecoin.assets.FIL;
        const from = initializeChain(Solana);
        const to = initializeChain(Filecoin);

        const renJS = new RenJS(network).withChains(to, from);

        const gatewayParams = {
            asset,
            // from: from.Transaction({
            //     // txidFormatted:
            //     // "0xef9d844602f21bae9cc38db39ce077f1bcff0517ae735f87c274b0d70e1fd6e5",
            //     txidFormatted:
            //         "5CuhGcME4DhLhtQ6PksgyL9rKs8UYUGc9rCzUBJGHRZM5VGp7oiXtKPjEwWyaa1rGvGqJ1ta74Y2mDbpaLLK1Gtb",
            // }),
            from: from.Account({ amount: 0.0001, convertUnit: true }),
            to: to.Address("t14wczuvodunv3xzexobzywpbj6qpr6jwdrbkrmbq"),
        };

        await defaultGatewayHandler(await renJS.gateway(gatewayParams));
    });

    it("DOGE/fromSolana", async function () {
        this.timeout(100000000000);

        const network = RenNetwork.Testnet;

        const asset = Dogecoin.assets.DOGE;
        const from = initializeChain(Solana);
        const to = initializeChain(Dogecoin);

        const renJS = new RenJS(network).withChains(to, from);

        const gatewayParams = {
            asset,
            from: from.Transaction({
                // txidFormatted:
                // "0xef9d844602f21bae9cc38db39ce077f1bcff0517ae735f87c274b0d70e1fd6e5",
                txidFormatted:
                    "5CuhGcME4DhLhtQ6PksgyL9rKs8UYUGc9rCzUBJGHRZM5VGp7oiXtKPjEwWyaa1rGvGqJ1ta74Y2mDbpaLLK1Gtb",
            }),
            // from: from.Account({ amount: 0.0001, convertUnit: true }),
            to: to.Address("t14wczuvodunv3xzexobzywpbj6qpr6jwdrbkrmbq"),
        };

        await defaultGatewayHandler(await renJS.gateway(gatewayParams));
    });

    it("LUNA/toSolana", async function () {
        this.timeout(100000000000);

        const network = RenNetwork.Testnet;
        const asset = Terra.assets.LUNA;
        const from = initializeChain<Terra>(Terra);
        const to = initializeChain(Solana);
        const renJS = new RenJS(network).withChains(from, to);

        const gatewayParams: GatewayParams = {
            asset,
            from: from.GatewayAddress(),
            to: to.Account(),
            nonce: 9,
        };

        await defaultGatewayHandler(await renJS.gateway(gatewayParams));
    });

    it("LUNA/fromSolana", async function () {
        this.timeout(100000000000);

        const network = RenNetwork.Testnet;
        const renJS = new RenJS(network);

        const asset = Terra.assets.LUNA;
        const solana = initializeChain(Solana);
        const terra = initializeChain<Terra>(Terra);
        renJS.withChains(terra, solana);

        const fees = await renJS.getFees({
            asset,
            from: solana,
            to: terra,
        });

        const minimumAmount = fees.minimumAmount;
        const amount = minimumAmount.times(2);

        const gatewayParams: GatewayParams = {
            asset: asset,
            from: solana.Account({ amount }),
            to: terra.Address("terra18wgytl2ktjulm00l2km4g3e3z8aqnmy7829tf6"),
        };

        await defaultGatewayHandler(await renJS.gateway(gatewayParams));
    });

    it("DAI/toSolana", async function () {
        this.timeout(100000000000);

        const network = RenNetwork.Testnet;
        const asset = Ethereum.assets.DAI;
        const from = initializeChain(Ethereum);
        const to = initializeChain(Solana);
        const renJS = new RenJS(network).withChains(from, to);

        const gatewayParams: GatewayParams = {
            asset,
            from: from.Account({ amount: 1, convertUnit: true }),
            to: to.Account(),
        };

        console.log(
            (await renJS.getFees(gatewayParams))
                .estimateOutput({
                    amount: "1.1",
                    convertUnit: true,
                })
                .toFixed(),
        );

        await defaultGatewayHandler(await renJS.gateway(gatewayParams));
    });

    it("BTC/toSolana", async function () {
        this.timeout(100000000000);

        const network = RenNetwork.Testnet;
        const asset = Bitcoin.assets.BTC;
        const from = initializeChain(Bitcoin);
        const to = initializeChain(Solana);
        const renJS = new RenJS(network).withChains(from, to);

        const gatewayParams: GatewayParams = {
            asset,
            from: from.GatewayAddress(),
            to: to.Account(),
            nonce: 7,
        };

        console.log(
            (await renJS.getFees(gatewayParams))
                .estimateOutput({
                    amount: "1.1",
                    convertUnit: true,
                })
                .toFixed(),
        );

        await defaultGatewayHandler(await renJS.gateway(gatewayParams));
    });

    it("BTC/fromSolana", async function () {
        this.timeout(100000000000);

        const network = RenNetwork.Testnet;
        const renJS = new RenJS(network);

        const asset = Bitcoin.assets.BTC;
        const solana = initializeChain(Solana);
        const bitcoin = initializeChain(Bitcoin);
        renJS.withChains(bitcoin, solana);

        const fees = await renJS.getFees({
            asset,
            from: solana,
            to: bitcoin,
        });

        const minimumAmount = fees.minimumAmount;
        const amount = minimumAmount.times(2);

        const gatewayParams: GatewayParams = {
            asset: asset,
            from: solana.Account({ amount }),
            to: bitcoin.Address("miMi2VET41YV1j6SDNTeZoPBbmH8B4nEx6"),
        };

        await defaultGatewayHandler(await renJS.gateway(gatewayParams));
    });

    it("DAI/fromBinanceSmartChain", async function () {
        this.timeout(100000000000);

        const network = RenNetwork.Testnet;

        const asset = Ethereum.assets.DAI;
        const ethereum = initializeChain(Ethereum);
        const bsc = initializeChain(BinanceSmartChain);

        const renJS = new RenJS(network).withChains(bsc, ethereum);

        const gatewayParams = {
            asset,
            from: bsc.Account({ amount: 0.5, convertUnit: true }),
            to: ethereum.Account(),
        };

        await defaultGatewayHandler(await renJS.gateway(gatewayParams));
    });

    it("DAI/fromBSCtoFantom", async function () {
        this.timeout(100000000000);

        const network = RenNetwork.Testnet;

        const asset = Ethereum.assets.DAI;
        const bsc = initializeChain(BinanceSmartChain);
        const fantom = initializeChain(Fantom);

        const renJS = new RenJS(network).withChains(bsc, fantom);

        const gatewayParams: GatewayParams = {
            asset,
            from: bsc.Account({ amount: 0.5, convertUnit: true }),
            to: fantom.Account(),
        };

        await defaultGatewayHandler(await renJS.gateway(gatewayParams));
    });

    it("DAI/toBinanceSmartChain", async function () {
        this.timeout(100000000000);

        const network = RenNetwork.Testnet;

        const asset = Ethereum.assets.DAI;
        const ethereum = initializeChain(Ethereum);
        const bsc = initializeChain(BinanceSmartChain);

        const renJS = new RenJS(network).withChains(bsc, ethereum);

        const gatewayParams: GatewayParams = {
            asset,
            from: ethereum.Account({ amount: 1, convertUnit: true }),
            // from: ethereum.Transaction({
            //     chain: "Ethereum",
            //     txidFormatted:
            //         "0x27a7df5508abf38946ee418c120c7ad9ae1c682ea5b7d9c6a5fa92b730cf3946",
            //     txid: "J6ffVQir84lG7kGMEgx62a4caC6lt9nGpfqStzDPOUY",
            //     txindex: "0",
            // }),
            to: bsc.Account(),
        };

        await defaultGatewayHandler(await renJS.gateway(gatewayParams));
    });
});
