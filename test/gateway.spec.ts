import { Solana } from "@renproject/chains";
import { getERC20Instance } from "@renproject/chains-ethereum/src/contracts";
import BigNumber from "bignumber.js";
import chai from "chai";
import { config as loadDotEnv } from "dotenv";
import { Bitcoin, Dogecoin } from "packages/chains/chains-bitcoin/src";
import {
    Arbitrum,
    Avalanche,
    BinanceSmartChain,
    Catalog,
    Ethereum,
    EthereumBaseChain,
    EVMParam,
    Goerli,
    Polygon,
} from "packages/chains/chains-ethereum/src";
import { Filecoin } from "packages/chains/chains-filecoin/src";
import RenJS from "packages/ren/src";
import { GatewayParams } from "packages/ren/src/params";
import { RenNetwork } from "packages/utils/src";

import { LogLevel } from "../packages/ren/build/utils/config";
import { defaultGatewayHandler } from "./utils/defaultGatewayHandler";
import { initializeChain } from "./utils/testUtils";

chai.should();

loadDotEnv();

describe("Gateway", () => {
    // it("burn sentry", async () => {
    //     const nonce = 1696;

    //     const { provider } = initializeChain(Ethereum, network, RenNetwork.Mainnet);
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
        const asset = Ethereum.assets[network].ETH;
        const from = initializeChain(Ethereum, network);
        const to = initializeChain(Catalog, network, {
            preserveAddressFormat: true,
        });
        const renJS = new RenJS(network).withChains(from, to);

        const gatewayParams: GatewayParams = {
            asset,
            from: from.Transaction({
                txHash: "0xc46b1a9a44c1a7041988100d0836d2e1837200ec35c82ff45ad8a7c501e23121",
            }),
            to: to.Contract({
                to: "0x96081a4e7C3617a4d7dAc9AC84D97255d63773d2",
                withRenParams: true,
                method: "mint",
                params: [
                    {
                        name: "_token",
                        value: "0x4680fb30aa384c15ce6b409a3f6ba9064587c321",
                        type: "address",
                    },
                    {
                        name: "_to",
                        value: "0x99b6be7f16a7bba42d7cdc9ca8e93028612dcbed",
                        type: "address",
                    },
                ],
            }),
        };

        await defaultGatewayHandler(await renJS.gateway(gatewayParams));
    }).timeout(100000000000);

    // it("Get fees", async () => {
    //     const network = RenNetwork.Testnet;
    //     const renJS = new RenJS();

    //     const asset = "LUNA";
    //     const from = initializeChain(Terra, network);
    //     const to = initializeChain(Ethereum, network);
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

        const asset = Ethereum.assets[network].DAI;
        const from = initializeChain(Ethereum, network);
        const to = initializeChain(Avalanche, network);

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

    it("ETH: Ethereum to Arbitrum", async () => {
        const network = RenNetwork.Testnet;

        const asset = Ethereum.assets[network].ETH;
        const from = initializeChain(Ethereum, network);
        const to = initializeChain(Arbitrum, network);

        const renJS = new RenJS(network).withChains(from, to);

        const gatewayParams: GatewayParams = {
            asset,
            from: from.Account({ amount: 0.001, convertUnit: true }),
            to: to.Account(),
        };

        // await defaultGatewayHandler(await renJS.gateway(gatewayParams));
    }).timeout(100000000000);

    it("FIL/toPolygon", async () => {
        const network = RenNetwork.Testnet;
        const asset = Filecoin.assets[network].FIL;
        const from = initializeChain(Filecoin, network);
        const to = initializeChain(Polygon, network);
        const renJS = new RenJS(network).withChains(from, to);

        const gatewayParams: GatewayParams = {
            asset,
            from: from.Transaction({
                txHash: "bafy2bzacebzfx7bxagpu3ptnehq5f3hmj2aqh6k3ihbniasu5xsld6xwilhjw",
            }),
            nonce: 19150000,
            to: to.Contract({
                to: "0xAC23817f7E9Ec7EB6B7889BDd2b50e04a44470c5",
                method: "mint",
                withRenParams: true,
                params: [
                    { type: "string", name: "_symbol", value: "FIL" },
                    {
                        type: "address",
                        name: "_address",
                        value: "0x4c84f5d473d33b96b43ec96f738b073c0fceb516",
                    },
                ],
                payloadConfig: {
                    preserveAddressFormat: true,
                },
            }),
        };

        await defaultGatewayHandler(await renJS.gateway(gatewayParams));
    }).timeout(100000000000);

    it("FIL/fromSolana", async () => {
        const network = RenNetwork.Testnet;

        const asset = Filecoin.assets[network].FIL;
        const from = initializeChain(Solana, network);
        const to = initializeChain(Filecoin, network);

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

        const asset = Dogecoin.assets[network].DOGE;
        const from = initializeChain(Solana, network);
        const to = initializeChain(Dogecoin, network);

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
    //     const asset = Terra.assets[network].LUNA;
    //     const from = initializeChain<Terra>(Terra);
    //     const to = initializeChain(Solana, network);
    //     const renJS = new RenJS(network).withChains(from, to);

    //     const gatewayParams: GatewayParams = {
    //         asset,
    //         from: from.GatewayAddress(),
    nonce: BigNumber.random()
        .times(2 ** 32)
        .decimalPlaces(0)
        .toNumber(),
        //         to: to.Account(),
        //         nonce: 9,
        //     };

        //     await defaultGatewayHandler(await renJS.gateway(gatewayParams));
        // }).timeout(100000000000);

        // it("LUNA/fromSolana", async () => {
        //     const network = RenNetwork.Testnet;
        //     const renJS = new RenJS(network);

        //     const asset = Terra.assets[network].LUNA;
        //     const solana = initializeChain(Solana, network);
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
            const asset = Avalanche.assets[network].AVAX;
            const from = initializeChain(Avalanche, network);
            const to = initializeChain(Solana, network);
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

    it.skip("DOGE/toSolana", async () => {
        const network = RenNetwork.Testnet;
        const asset = Dogecoin.assets[network].DOGE;
        const from = initializeChain(Dogecoin, network);
        const to = initializeChain(Solana, network);
        const renJS = new RenJS(network).withChains(from, to);

        const gatewayParams: GatewayParams = {
            asset,
            from: from.GatewayAddress(),
            nonce: BigNumber.random()
                .times(2 ** 32)
                .decimalPlaces(0)
                .toNumber(),
            to: to.Account(),
        };

        // console.info(
        //     (await renJS.getFees(gatewayParams))
        //         .estimateOutput({
        //             amount: "1.1",
        //             convertUnit: true,
        //         })
        //         .toFixed(),
        // );

        await defaultGatewayHandler(await renJS.gateway(gatewayParams));
    }).timeout(100000000000);

    it.only("ETH/toCatalog", async () => {
        const network = RenNetwork.Testnet;
        const renJS = new RenJS(network, { logLevel: LogLevel.Debug });

        const asset = Goerli.assets[network].ETH;
        const from = initializeChain(Ethereum, network);
        const to = initializeChain(Catalog, network);
        renJS.withChains(to, from);

        const decimals = await from.assetDecimals(asset);

        const amount = new BigNumber(0.001).shiftedBy(decimals);

        // const fees = await renJS.getFees({
        //     asset,
        //     from: from,
        //     to: to,
        // });

        console.log(await to.signer.getAddress());

        const gatewayParams: GatewayParams = {
            asset: asset,
            from: from.Account({
                amount,
                payloadConfig: { detectPreviousDeposits: true },
            }),
            to: to.Account(),
        };

        await defaultGatewayHandler(await renJS.gateway(gatewayParams));
    }).timeout(100000000000);

    it("USDT/toCatalog", async () => {
        const network = RenNetwork.Testnet;

        const from = initializeChain(Goerli, network);
        const catalog = initializeChain(Catalog, network);
        const bsc = initializeChain(BinanceSmartChain, network);
        const polygon = initializeChain(Polygon, network);
        const renJS = new RenJS(network).withChains(
            from,
            catalog,
            bsc,
            polygon,
        );

        // console.log(await catalog.getRenAsset(from.assets.DAI));

        // console.log(await from.signer!.getAddress());

        // console.log(
        //     Goerli.assets[network].USDT,
        //     (await from.getBalance(Goerli.assets[network].USDT))
        //         .shiftedBy(-(await from.assetDecimals(Goerli.assets[network].USDT)))
        //         .toFixed(),
        // );
        // console.log(
        //     Goerli.assets[network].DAI,
        //     (await from.getBalance(Goerli.assets[network].DAI))
        //         .shiftedBy(-(await from.assetDecimals(Goerli.assets[network].DAI)))
        //         .toFixed(),
        // );
        // console.log(
        //     Goerli.assets[network].USDC,
        //     (await from.getBalance(Goerli.assets[network].USDC))
        //         .shiftedBy(-(await from.assetDecimals(Goerli.assets[network].USDC)))
        //         .toFixed(),
        // );

        const options: Array<[string, EthereumBaseChain]> = [
            [Goerli.assets[network].USDT, catalog],
            [Goerli.assets[network].USDC, catalog],
            [Goerli.assets[network].DAI, catalog],
            // [Goerli.assets[network].USDT, bsc],
            // [Goerli.assets[network].USDC, bsc],
            // [Goerli.assets[network].DAI, bsc],
            // [Goerli.assets[network].USDT, polygon],
            // [Goerli.assets[network].USDC, polygon],
            // [Goerli.assets[network].DAI, polygon],
        ];

        for (const [asset, to] of options) {
            // const asset = Ethereum.assets[network].USDT;
            const decimals = await from.assetDecimals(asset);

            const amount = 10.2;

            const gatewayParams = {
                asset,
                from: from.Account({ amount, convertUnit: true }),
                to: to.Address("0x5eb99e19183728404AaeBc8eEF47C085dBE86F54"),
            };

            await defaultGatewayHandler(
                await renJS.gateway(gatewayParams),
                new BigNumber(amount).shiftedBy(decimals),
            );

            console.log(
                asset,
                "on",
                to.chain,
                (
                    await to.getBalance(
                        asset,
                        "0x5eb99e19183728404AaeBc8eEF47C085dBE86F54",
                    )
                )
                    .shiftedBy(-(await to.assetDecimals(asset)))
                    .toFixed(),
            );
        }
    }).timeout(100000000000);

    it("BTC/to catalog chains", async () => {
        const network = RenNetwork.Testnet;

        const from = initializeChain(Bitcoin, network);
        const asset = from.assets.BTC;
        const catalog = initializeChain(Catalog, network);
        const bsc = initializeChain(BinanceSmartChain, network);
        const polygon = initializeChain(Polygon, network);
        const ethereum = initializeChain(Ethereum, network);
        const renJS = new RenJS(network).withChains(
            from,
            catalog,
            bsc,
            polygon,
            ethereum,
        );

        const options: EthereumBaseChain[] = [catalog, bsc, polygon, ethereum];

        for (const to of options) {
            // const asset = Ethereum.assets[network].USDT;

            const gatewayParams = {
                asset,
                from: from.GatewayAddress(),
                to: to.Address("0x5eb99e19183728404AaeBc8eEF47C085dBE86F54"),
            };

            await defaultGatewayHandler(await renJS.gateway(gatewayParams));

            console.log(
                asset,
                "on",
                to.chain,
                (
                    await to.getBalance(
                        asset,
                        "0x5eb99e19183728404AaeBc8eEF47C085dBE86F54",
                    )
                )
                    .shiftedBy(-(await to.assetDecimals(asset)))
                    .toFixed(),
            );
        }
    }).timeout(100000000000);

    it("REN/toSolana", async () => {
        const network = RenNetwork.Testnet;

        const asset = Ethereum.assets[network].REN;
        const from = initializeChain(Solana, network);
        const to = initializeChain(Ethereum, network);

        const renJS = new RenJS(network).withChains(from, to);

        const gatewayParams: GatewayParams = {
            asset,
            from: from.Account({ amount: 95, convertUnit: true }),
            to: to.Account(),
        };

        const _fees = await renJS.getFees(gatewayParams);

        await defaultGatewayHandler(await renJS.gateway(gatewayParams));
    }).timeout(100000000000);

    it("DAI/toBinanceSmartChain", async () => {
        const network = RenNetwork.Testnet;

        const asset = Ethereum.assets[network].DAI;
        const ethereum = initializeChain(Ethereum, network);
        const bsc = initializeChain(BinanceSmartChain, network);

        const renJS = new RenJS(network).withChains(bsc, ethereum);

        const gatewayParams: GatewayParams = {
            asset,
            from: ethereum.Account({ amount: 1, convertUnit: true }),
            to: bsc.Account(),
        };

        await defaultGatewayHandler(await renJS.gateway(gatewayParams));
    }).timeout(100000000000);
});
