import {
    getRenNetworkDetails,
    RenNetwork,
    RenNetworkDetails,
    RenNetworkString,
} from "@renproject/interfaces";
import { Callable, utilsWithChainNetwork } from "@renproject/utils";
import { provider } from "web3-core";
import { NetworkInput } from "./base";
import { EthAddress, EthTransaction } from "./types";

import { EthereumClass } from "./ethereum";
import { EthereumConfig, StandardExplorer } from "./networks";
import { addressIsValid, transactionIsValid } from "./utils";

export const renBscTestnet: EthereumConfig = {
    name: "BSC Testnet",
    chain: "bscTestnet",
    isTestnet: true,
    chainLabel: "BSC Testnet",
    networkID: 97,
    addresses: {
        GatewayRegistry: "0x838F881876f53a772D2F8E2f8aa2e4a996431495",
        BasicAdapter: "0x7de1253A8da6620351ec477b38BdC6a55FCd0f85",
    },

    publicProvider: () => `https://data-seed-prebsc-1-s1.binance.org:8545/`,
    explorer: StandardExplorer("https://testnet.bscscan.com"),

    /** @deprecated Renamed to publicProvider. Will be removed in 3.0.0. */
    infura: "https://data-seed-prebsc-1-s1.binance.org:8545/",
    /** @deprecated Renamed to explorer. Will be removed in 3.0.0. */
    etherscan: "https://testnet.bscscan.com",
};

export const renBscDevnet: EthereumConfig = {
    ...renBscTestnet,
    addresses: {
        GatewayRegistry: "0x87e83f957a2F3A2E5Fe16d5C6B22e38FD28bdc06",
        BasicAdapter: "0x105435a9b0f375B179e5e43A16228C04F01Fb2ee",
    },
};

export const renBscMainnet: EthereumConfig = {
    name: "BSC Mainnet",
    chain: "bscMainnet",
    isTestnet: false,
    chainLabel: "BSC Mainnet",
    networkID: 56,
    addresses: {
        GatewayRegistry: "0x21C482f153D0317fe85C60bE1F7fa079019fcEbD",
        BasicAdapter: "0xAC23817f7E9Ec7EB6B7889BDd2b50e04a44470c5",
    },

    publicProvider: () => `https://bsc-dataseed.binance.org`,
    explorer: StandardExplorer("https://bscscan.com"),

    /** @deprecated Renamed to publicProvider. Will be removed in 3.0.0. */
    infura: "https://bsc-dataseed.binance.org",
    /** @deprecated Renamed to explorer. Will be removed in 3.0.0. */
    etherscan: "https://bscscan.com",
};

export const BscConfigMap = {
    [RenNetwork.MainnetVDot3]: renBscMainnet,
    [RenNetwork.TestnetVDot3]: renBscTestnet,
    [RenNetwork.DevnetVDot3]: renBscDevnet,
};

const resolveBSCNetwork = (
    renNetwork?:
        | RenNetwork
        | RenNetworkString
        | RenNetworkDetails
        | EthereumConfig,
) => {
    if (!renNetwork) {
        return BscConfigMap[RenNetwork.MainnetVDot3];
    }
    if ((renNetwork as EthereumConfig).addresses) {
        return renNetwork as EthereumConfig;
    } else {
        const details = getRenNetworkDetails(
            // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
            renNetwork as RenNetwork | RenNetworkString | RenNetworkDetails,
        );
        return details.isTestnet
            ? details.name === RenNetwork.DevnetVDot3
                ? renBscDevnet
                : renBscTestnet
            : renBscMainnet;
    }
};

export class BinanceSmartChainClass extends EthereumClass {
    public static chain = "BinanceSmartChain";
    public chain = BinanceSmartChainClass.chain;
    public name = BinanceSmartChainClass.chain;
    public legacyName = undefined;
    public logRequestLimit = 5000;

    public static configMap = BscConfigMap;
    public configMap = BscConfigMap;

    public static utils = {
        resolveChainNetwork: resolveBSCNetwork,
        addressIsValid,
        transactionIsValid,
        addressExplorerLink: (
            address: EthAddress,
            network?: NetworkInput,
        ): string =>
            `${
                (
                    BinanceSmartChain.utils.resolveChainNetwork(network) ||
                    renBscMainnet
                ).etherscan
            }/address/${address}`,

        transactionExplorerLink: (
            transaction: EthTransaction,
            network?: NetworkInput,
        ): string =>
            `${
                (
                    BinanceSmartChain.utils.resolveChainNetwork(network) ||
                    renBscMainnet
                ).etherscan
            }/tx/${transaction || ""}`,
    };

    public utils = utilsWithChainNetwork(
        BinanceSmartChainClass.utils,
        () => this.renNetworkDetails,
    );

    constructor(
        web3Provider: provider,
        renNetwork:
            | RenNetwork
            | RenNetworkString
            | RenNetworkDetails
            | EthereumConfig,
    ) {
        // To be compatible with the Ethereum chain class, the first parameter
        // is a web3Provider and the second the RenVM network. However,
        super(web3Provider, resolveBSCNetwork(renNetwork));
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
// @dev Removes any static fields, except `utils`.
export const BinanceSmartChain = Callable(BinanceSmartChainClass);
