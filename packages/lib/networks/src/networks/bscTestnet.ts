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
    // etherscan: "https://explorer.binance.org/smart-testnet",
    etherscan: "https://testnet.bscscan.com",
    addresses: {
        GatewayRegistry: {
            address: "0x87e83f957a2F3A2E5Fe16d5C6B22e38FD28bdc06",
            abi: GatewayRegistry.abi as AbiItem[],
            artifact: GatewayRegistry,
        },
        RenERC20: {
            abi: RenERC20.abi as AbiItem[],
            artifact: (RenERC20 as unknown) as Contract,
        },
        Gateway: {
            abi: GatewayLogic.abi as AbiItem[],
            artifact: (GatewayLogic as unknown) as Contract,
        },
        BasicAdapter: {
            address: "0x105435a9b0f375B179e5e43A16228C04F01Fb2ee",
            abi: BasicAdapter.abi as AbiItem[],
            artifact: (BasicAdapter as unknown) as Contract,
        },
    },
});
