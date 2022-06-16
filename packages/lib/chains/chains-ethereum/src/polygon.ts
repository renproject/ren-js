import {
    getRenNetworkDetails,
    Logger,
    RenNetwork,
    RenNetworkDetails,
    RenNetworkString,
} from "@renproject/interfaces";
import { Callable, utilsWithChainNetwork } from "@renproject/utils";

import { NetworkInput } from "./base";
import { EthAddress, EthProvider, EthTransaction } from "./types";

import { EthereumClass } from "./ethereum";
import { EthereumConfig, StandardExplorer } from "./networks";
import { addressIsValid, transactionIsValid } from "./utils";

export const renPolygonTestnet: EthereumConfig = {
    name: "Polygon Testnet",
    chain: "polygonTestnet",
    isTestnet: true,
    chainLabel: "Polygon Testnet",
    networkID: 80001,
    addresses: {
        GatewayRegistry: "0xD881213F5ABF783d93220e6bD3Cc21706A8dc1fC",
        BasicAdapter: "0xD087b0540e172553c12DEEeCDEf3dFD21Ec02066",
    },

    publicProvider: () => `https://rpc-mumbai.maticvigil.com`,
    explorer: StandardExplorer("https://mumbai.polygonscan.com"),

    /** @deprecated Renamed to publicProvider. Will be removed in 3.0.0. */
    infura: "https://rpc-mumbai.maticvigil.com",
    /** @deprecated Renamed to explorer. Will be removed in 3.0.0. */
    etherscan: "https://mumbai.polygonscan.com/",
};

export const renPolygonMainnet: EthereumConfig = {
    name: "Polygon Mainnet",
    chain: "polygonMainnet",
    isTestnet: false,
    chainLabel: "Polygon Mainnet",
    networkID: 137,
    addresses: {
        GatewayRegistry: "0x21C482f153D0317fe85C60bE1F7fa079019fcEbD",
        BasicAdapter: "0xAC23817f7E9Ec7EB6B7889BDd2b50e04a44470c5",
    },

    publicProvider: () => `https://polygon-rpc.com`,
    explorer: StandardExplorer("https://polygonscan.com"),

    /** @deprecated Renamed to publicProvider. Will be removed in 3.0.0. */
    infura: "https://polygon-rpc.com",
    /** @deprecated Renamed to explorer. Will be removed in 3.0.0. */
    etherscan: "https://polygonscan.com",
};

export const PolygonConfigMap = {
    [RenNetwork.Testnet]: renPolygonTestnet,
    [RenNetwork.Mainnet]: renPolygonMainnet,
};

const resolvePolygonNetwork = (
    renNetwork?:
        | RenNetwork
        | RenNetworkString
        | RenNetworkDetails
        | EthereumConfig,
) => {
    if (!renNetwork) {
        return PolygonConfigMap[RenNetwork.Mainnet];
    }
    if ((renNetwork as EthereumConfig).addresses) {
        return renNetwork as EthereumConfig;
    } else {
        const details = getRenNetworkDetails(
            // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
            renNetwork as RenNetwork | RenNetworkString | RenNetworkDetails,
        );
        return details.isTestnet ? renPolygonTestnet : renPolygonMainnet;
    }
};

export class PolygonClass extends EthereumClass {
    public static chain = "Polygon";
    public chain = PolygonClass.chain;
    public name = PolygonClass.chain;
    public legacyName = undefined;
    public logRequestLimit = 1000;

    public static configMap = PolygonConfigMap;
    public configMap = PolygonConfigMap;

    public static utils = {
        resolveChainNetwork: resolvePolygonNetwork,
        addressIsValid,
        transactionIsValid,
        addressExplorerLink: (
            address: EthAddress,
            network?: NetworkInput,
        ): string =>
            `${
                (
                    Polygon.utils.resolveChainNetwork(network) ||
                    renPolygonMainnet
                ).etherscan
            }/address/${address}`,

        transactionExplorerLink: (
            transaction: EthTransaction,
            network?: NetworkInput,
        ): string =>
            `${
                (
                    Polygon.utils.resolveChainNetwork(network) ||
                    renPolygonMainnet
                ).etherscan
            }/tx/${transaction || ""}`,
    };

    public utils = utilsWithChainNetwork(
        PolygonClass.utils,
        () => this.renNetworkDetails,
    );

    constructor(
        web3Provider: EthProvider,
        renNetwork:
            | RenNetwork
            | RenNetworkString
            | RenNetworkDetails
            | EthereumConfig,
        config: {
            logger?: Logger;
        } = {},
    ) {
        // To be compatible with the Ethereum chain class, the first parameter
        // is a web3Provider and the second the RenVM network.
        super(web3Provider, resolvePolygonNetwork(renNetwork), config);
    }

    initialize = (
        renNetwork: RenNetwork | RenNetworkString | RenNetworkDetails,
    ) => {
        this.renNetworkDetails =
            this.renNetworkDetails ||
            PolygonConfigMap[getRenNetworkDetails(renNetwork).name];

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

export type Polygon = PolygonClass;
// @dev Removes any static fields, except `utils`.
export const Polygon = Callable(PolygonClass);
