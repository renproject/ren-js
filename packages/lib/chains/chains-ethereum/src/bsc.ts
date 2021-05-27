import {
    getRenNetworkDetails,
    RenNetwork,
    RenNetworkDetails,
    RenNetworkString,
} from "@renproject/interfaces";
import { Callable, utilsWithChainNetwork } from "@renproject/utils";
import { provider } from "web3-providers";
import { EthAddress, EthTransaction, NetworkInput } from "./base";

import { EthereumClass } from "./ethereum";
import { EthereumConfig } from "./networks";
import { addressIsValid, findTransactionBySigHash } from "./utils";

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

export const renBscMainnet: EthereumConfig = {
    name: "BSC Mainnet",
    chain: "bscMainnet",
    isTestnet: false,
    chainLabel: "BSC Mainnet",
    networkID: 56,
    infura: "https://bsc-dataseed.binance.org/",
    etherscan: "https://bscscan.com",
    addresses: {
        GatewayRegistry: "0x21C482f153D0317fe85C60bE1F7fa079019fcEbD",
        BasicAdapter: "0xAC23817f7E9Ec7EB6B7889BDd2b50e04a44470c5",
    },
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

    public static utils = {
        resolveChainNetwork: resolveBSCNetwork,
        addressIsValid,
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
            }/tx/${transaction}`,
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
