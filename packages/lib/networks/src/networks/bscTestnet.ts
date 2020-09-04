import BasicAdapter from "@renproject/sol/build/testnet/BasicAdapter.json";
import GatewayLogic from "@renproject/sol/build/testnet/GatewayLogicV1.json";
import GatewayRegistry from "@renproject/sol/build/testnet/GatewayRegistry.json";
import RenERC20 from "@renproject/sol/build/testnet/RenERC20LogicV1.json";
import { AbiItem } from "web3-utils";

import { CastNetwork, Contract } from "./network";

const networkID = 97;

export const renBscTestnet = CastNetwork({
    version: "1.0.0",
    name: "bscTestnet",
    chain: "bscTestnet",
    isTestnet: true,
    label: "Binance Testnet",
    chainLabel: "Binance Testnet",
    networkID,
    infura: "https://data-seed-prebsc-1-s1.binance.org:8545",
    etherscan: "https://explorer.binance.org/smart-testnet",
    addresses: {
        GatewayRegistry: {
            address: "0xf1DA6f4A594553335EdeA6B1203a4B590c752E32",
            abi: GatewayRegistry.abi as AbiItem[],
            artifact: GatewayRegistry,
        },
        RenERC20: {
            abi: RenERC20.abi as AbiItem[],
            artifact: RenERC20 as Contract,
        },
        Gateway: {
            abi: GatewayLogic.abi as AbiItem[],
            artifact: GatewayLogic as Contract,
        },
        BasicAdapter: {
            address: "0xD881213F5ABF783d93220e6bD3Cc21706A8dc1fC",
            abi: BasicAdapter.abi as AbiItem[],
            artifact: BasicAdapter as Contract,
        },
    },
});
