import { getERC20Instance } from "@renproject/chains-ethereum/src/contracts";
import BigNumber from "bignumber.js";
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
import RenJS from "packages/ren/src";
import { GatewayParams } from "packages/ren/src/params";
import { RenNetwork } from "packages/utils/src";

import {
    Arbitrum,
    BitcoinCash,
    DigiByte,
    Dogecoin,
    EVMParam,
    Filecoin,
    Polygon,
    Terra,
} from "../packages/chains/chains/src";
import { defaultGatewayHandler } from "./utils/defaultGatewayHandler";
import { initializeChain } from "./utils/testUtils";

chai.should();

loadDotEnv();

describe("Gateway", () => {
    // it("burn sentry", async () => {
    //     const nonce = 44530;

    //     const { provider } = initializeChain(Ethereum, RenNetwork.Mainnet);
    //     const asset = "BTC";

    //     const gatewayAddress = await getMintGateway(
    //         Ethereum.configMap.mainnet,
    //         provider,
    //         asset,
    //     );

    //     const burnLogs = await provider.getLogs({
    //         address: gatewayAddress,
    //         fromBlock: 0,
    //         toBlock: "latest",
    //         topics: [
    //             utils.Ox(
    //                 utils.keccak256(
    //                     Buffer.from("LogBurn(bytes,uint256,uint256,bytes)"),
    //                 ),
    //             ),
    //             utils.Ox(utils.toNBytes(nonce, 32)),
    //         ],
    //     });
    //     console.info(burnLogs[0]);
    // });

    it("recover", async () => {
        const network = RenNetwork.Mainnet;
        const asset = Dogecoin.assets.DOGE;
        const from = initializeChain(Solana, network);
        const to = initializeChain<Dogecoin>(Dogecoin, network);
        const renJS = new RenJS(network).withChains(from, to);

        const gatewayParams: GatewayParams = {
            asset,
            from: from.Transaction({
                txHash: "5wxeaRWAY9Wit6NAen5HAoD8X8pEMgw6FdAQryq6nV9adeKUismzRjSAsxwy1fCnDCYaxxTxDn1XFvrxExQ6zdTv",
            }),
            to: to.Address("DE8aTAaquSdsWuMJ51zFWqVsPaUd2Zdhdi"),
        };

        await defaultGatewayHandler(await renJS.gateway(gatewayParams));
    }).timeout(100000000000);

    // it("Get fees", async () => {
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

    //     console.info(
    //         fees
    //             .estimateOutput(new BigNumber(100000).shiftedBy(decimals))
    //             .shiftedBy(-decimals)
    //             .toFixed(),
    //         asset,
    //     );
    // }).timeout(100000000000);

    it("DAI: Ethereum to Avalache", async () => {
        const network = RenNetwork.Testnet;
        const renJS = new RenJS(network);

        const asset = Ethereum.assets.DAI;
        const from = initializeChain(Ethereum);
        const to = initializeChain(Avalanche);
        renJS.withChains(from, to);

        const address = await from.signer.getAddress();

        const amount = new BigNumber(0.1).shiftedBy(18);

        const dai = getERC20Instance(
            from.signer,
            await from.getLockAsset(asset),
        );
        const tx = await dai.approve(
            "0xcb6bD6B6c7D7415C0157e393Bb2B6Def7555d518",
            amount.toFixed(),
        );
        await tx.wait();

        const gatewayParams: GatewayParams = {
            asset,
            from: from.Contract({
                to: "0xcb6bD6B6c7D7415C0157e393Bb2B6Def7555d518",
                method: "lock",
                withRenParams: false,
                params: [
                    {
                        type: "string",
                        name: "symbol",
                        value: EVMParam.EVM_ASSET,
                    },
                    {
                        type: "string",
                        name: "recipientAddress",
                        value: EVMParam.EVM_TO_ADDRESS,
                    },
                    {
                        type: "string",
                        name: "recipientChain",
                        value: EVMParam.EVM_TO_CHAIN,
                    },
                    {
                        type: "bytes",
                        name: "recipientPayload",
                        value: EVMParam.EVM_TO_PAYLOAD,
                    },
                    {
                        type: "uint256",
                        name: "amount",
                        value: amount.toFixed(),
                    },
                ],
            }),
            to: to.Contract({
                to: "0xcb6bD6B6c7D7415C0157e393Bb2B6Def7555d518",
                method: "mint",
                withRenParams: true,
                params: [
                    {
                        type: "string",
                        name: "symbol",
                        value: EVMParam.EVM_ASSET,
                    },
                    {
                        type: "address",
                        name: "recipient",
                        value: address,
                    },
                ],
            }),
        };

        await defaultGatewayHandler(await renJS.gateway(gatewayParams));
    }).timeout(100000000000);

    it("ETH: BSC to Ethereum", async () => {
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
    }).timeout(100000000000);

    it("FIL/toSolana", async () => {
        const network = RenNetwork.Testnet;
        const asset = Filecoin.assets.FIL;
        const from = initializeChain(Filecoin);
        const to = initializeChain(Solana);
        const renJS = new RenJS(network).withChains(from, to);

        const gatewayParams: GatewayParams = {
            asset,
            from: from.GatewayAddress(),
            to: to.Account(),
        };

        await defaultGatewayHandler(await renJS.gateway(gatewayParams));
    }).timeout(100000000000);

    it("FIL/fromSolana", async () => {
        const network = RenNetwork.Testnet;

        const asset = Filecoin.assets.FIL;
        const from = initializeChain(Solana);
        const to = initializeChain(Filecoin);

        const renJS = new RenJS(network).withChains(to, from);

        const gatewayParams = {
            asset,
            // from: from.Transaction({
            //     // txHash:
            //     // "0xef9d844602f21bae9cc38db39ce077f1bcff0517ae735f87c274b0d70e1fd6e5",
            //     txHash:
            //         "5CuhGcME4DhLhtQ6PksgyL9rKs8UYUGc9rCzUBJGHRZM5VGp7oiXtKPjEwWyaa1rGvGqJ1ta74Y2mDbpaLLK1Gtb",
            // }),
            from: from.Account({ amount: 0.0001, convertUnit: true }),
            to: to.Address("t14wczuvodunv3xzexobzywpbj6qpr6jwdrbkrmbq"),
        };

        await defaultGatewayHandler(await renJS.gateway(gatewayParams));
    }).timeout(100000000000);

    it("DOGE/fromSolana", async () => {
        const network = RenNetwork.Testnet;

        const asset = Dogecoin.assets.DOGE;
        const from = initializeChain(Solana);
        const to = initializeChain(Dogecoin);

        const renJS = new RenJS(network).withChains(to, from);

        const gatewayParams = {
            asset,
            from: from.Transaction({
                // txHash:
                // "0xef9d844602f21bae9cc38db39ce077f1bcff0517ae735f87c274b0d70e1fd6e5",
                txHash: "5CuhGcME4DhLhtQ6PksgyL9rKs8UYUGc9rCzUBJGHRZM5VGp7oiXtKPjEwWyaa1rGvGqJ1ta74Y2mDbpaLLK1Gtb",
            }),
            // from: from.Account({ amount: 0.0001, convertUnit: true }),
            to: to.Address("t14wczuvodunv3xzexobzywpbj6qpr6jwdrbkrmbq"),
        };

        await defaultGatewayHandler(await renJS.gateway(gatewayParams));
    }).timeout(100000000000);

    // it("LUNA/toSolana", async () => {
    //     const network = RenNetwork.Testnet;
    //     const asset = Terra.assets.LUNA;
    //     const from = initializeChain<Terra>(Terra);
    //     const to = initializeChain(Solana);
    //     const renJS = new RenJS(network).withChains(from, to);

    //     const gatewayParams: GatewayParams = {
    //         asset,
    //         from: from.GatewayAddress(),
    //         to: to.Account(),
    //         nonce: 9,
    //     };

    //     await defaultGatewayHandler(await renJS.gateway(gatewayParams));
    // }).timeout(100000000000);

    // it("LUNA/fromSolana", async () => {
    //     const network = RenNetwork.Testnet;
    //     const renJS = new RenJS(network);

    //     const asset = Terra.assets.LUNA;
    //     const solana = initializeChain(Solana);
    //     const terra = initializeChain<Terra>(Terra);
    //     renJS.withChains(terra, solana);

    //     const fees = await renJS.getFees({
    //         asset,
    //         from: solana,
    //         to: terra,
    //     });

    //     const minimumAmount = fees.minimumAmount;
    //     const amount = minimumAmount.times(2);

    //     const gatewayParams: GatewayParams = {
    //         asset: asset,
    //         from: solana.Account({ amount }),
    //         to: terra.Address("terra18wgytl2ktjulm00l2km4g3e3z8aqnmy7829tf6"),
    //     };

    //     await defaultGatewayHandler(await renJS.gateway(gatewayParams));
    // }).timeout(100000000000);

    it("AVAX/toSolana", async () => {
        const network = RenNetwork.Testnet;
        const asset = Avalanche.assets.AVAX;
        const from = initializeChain(Avalanche);
        const to = initializeChain(Solana);
        const renJS = new RenJS(network).withChains(from, to);

        const amount = new BigNumber(2).shiftedBy(18);

        // const dai = getERC20Instance(
        //     from.signer,
        //     await from.getLockAsset(asset),
        // );
        // const tx = await dai.approve(
        //     "0x5076a1F237531fa4dC8ad99bb68024aB6e1Ff701",
        //     amount.toFixed(),
        // );
        // console.info(tx.hash);
        // await tx.wait();

        // console.info(
        //     new BigNumber(
        //         (
        //             await dai.allowance(
        //                 await from.signer.getAddress(),
        //                 "0x5076a1F237531fa4dC8ad99bb68024aB6e1Ff701",
        //             )
        //         ).toString(),
        //     )
        //         .shiftedBy(-18)
        //         .toFixed(),
        //     "DAI",
        // );

        const gatewayParams: GatewayParams = {
            asset,
            from: from.Account({ amount }),
            to: to.Account(),
        };

        console.info(
            (await renJS.getFees(gatewayParams))
                .estimateOutput({
                    amount: "1.1",
                    convertUnit: true,
                })
                .toFixed(),
        );

        await defaultGatewayHandler(await renJS.gateway(gatewayParams));
    }).timeout(100000000000);

    it("FIL/toSolana", async () => {
        const network = RenNetwork.Testnet;
        const asset = Filecoin.assets.FIL;
        const from = initializeChain(Filecoin);
        const to = initializeChain(Solana);
        const renJS = new RenJS(network).withChains(from, to);

        const gatewayParams: GatewayParams = {
            asset,
            from: from.GatewayAddress(),
            to: to.Account(),
            nonce: 7,
        };

        console.info(
            (await renJS.getFees(gatewayParams))
                .estimateOutput({
                    amount: "1.1",
                    convertUnit: true,
                })
                .toFixed(),
        );

        await defaultGatewayHandler(await renJS.gateway(gatewayParams));
    }).timeout(100000000000);

    it("AVAX/fromSolana", async () => {
        const network = RenNetwork.Testnet;
        const renJS = new RenJS(network);

        const asset = Avalanche.assets.AVAX;
        const from = initializeChain(Solana);
        const to = initializeChain(Avalanche);
        renJS.withChains(to, from);

        const amount = new BigNumber(1).shiftedBy(18);

        // const fees = await renJS.getFees({
        //     asset,
        //     from: from,
        //     to: to,
        // });

        const gatewayParams: GatewayParams = {
            asset: asset,
            from: from.Account({ amount }),
            // from: from.Transaction({
            //     txid: "VKzZnqT-sO9kKt43HgCE4Jc18Zd3q5pHddDwK2-2Xw9QMSfqGKS6g-QcPNVMcKMddf16nC0wQf3y25UQU1eeCg",
            // }),
            to: to.Address(await to.signer.getAddress()),
        };

        await defaultGatewayHandler(await renJS.gateway(gatewayParams));
    }).timeout(100000000000);

    it("DAI/fromBinanceSmartChain", async () => {
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
    }).timeout(100000000000);

    it("DAI/fromBSCtoFantom", async () => {
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
    }).timeout(100000000000);

    it("DAI/toBinanceSmartChain", async () => {
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
            //     txHash:
            //         "0x27a7df5508abf38946ee418c120c7ad9ae1c682ea5b7d9c6a5fa92b730cf3946",
            //     txid: "J6ffVQir84lG7kGMEgx62a4caC6lt9nGpfqStzDPOUY",
            //     txindex: "0",
            // }),
            to: bsc.Account(),
        };

        await defaultGatewayHandler(await renJS.gateway(gatewayParams));
    }).timeout(100000000000);
});
