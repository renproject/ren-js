import {
    getRenNetworkDetails,
    RenNetwork,
    RenNetworkDetails,
    RenNetworkString,
} from "@renproject/interfaces";
import { Callable } from "@renproject/utils";
import Web3 from "web3";
import { provider } from "web3-providers";

import { EthereumClass } from "./ethereum";
import { EthereumConfig } from "./networks";

export const renBscTestnet: EthereumConfig = {
    name: "BSC Testnet",
    chain: "bscTestnet",
    isTestnet: true,
    chainLabel: "BSC Testnet",
    networkID: 97,
    infura: "https://data-seed-prebsc-1-s1.binance.org:8545",
    // etherscan: "https://explorer.binance.org/smart-testnet",
    etherscan: "https://testnet.bscscan.com",
    addresses: {
        GatewayRegistry: "0x838F881876f53a772D2F8E2f8aa2e4a996431495",
        BasicAdapter: "0x7de1253A8da6620351ec477b38BdC6a55FCd0f85",
    },
};

export const renBscDevnet: EthereumConfig = {
    ...renBscTestnet,
    addresses: {
        GatewayRegistry: "0x87e83f957a2F3A2E5Fe16d5C6B22e38FD28bdc06",
        BasicAdapter: "0x105435a9b0f375B179e5e43A16228C04F01Fb2ee",
    },
};

export const BscConfigMap = {
    [RenNetwork.TestnetVDot3]: renBscTestnet,
};

const getRenBscMainnet = () => {
    throw new Error(`BSC mainnet is not supported yet.`);
};

export class BinanceSmartChainClass extends EthereumClass {
    public name = "BinanceSmartChain";
    public legacyName = undefined;

    constructor(
        web3Provider: provider | "mainnet" | "testnet" = "mainnet",
        network: "mainnet" | "testnet" = "mainnet",
    ) {
        // To be compatible with the Ethereum chain class, the first parameter
        // is a web3Provider and the second the RenVM network. However,
        super(
            web3Provider === "mainnet" || web3Provider === "testnet"
                ? new Web3(
                      (web3Provider === "testnet"
                          ? renBscTestnet
                          : getRenBscMainnet()
                      ).infura,
                  ).currentProvider
                : web3Provider,
            web3Provider === "testnet" || network === "testnet"
                ? renBscTestnet
                : undefined,
        );
    }

    initialize = (
        renNetwork: RenNetwork | RenNetworkString | RenNetworkDetails,
    ) => {
        this.renNetworkDetails =
            this.renNetworkDetails ||
            BscConfigMap[getRenNetworkDetails(renNetwork).name];

        if (!this.renNetworkDetails) {
            throw new Error(
                `Unable to set ${this.name} network for RenVM network ${
                    getRenNetworkDetails(renNetwork).name
                }. Please provide ${this.name} network details to ${
                    this.name
                } constructor.`,
            );
        }
        return this;
    };
}

export type BinanceSmartChain = BinanceSmartChainClass;
export const BinanceSmartChain = Callable(BinanceSmartChainClass);
