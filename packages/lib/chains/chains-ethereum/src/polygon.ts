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
import { addressIsValid } from "./utils";

export const renPolygonTestnet: EthereumConfig = {
    name: "Polygon Testnet",
    chain: "polygonTestnet",
    isTestnet: true,
    chainLabel: "Polygon Testnet",
    networkID: 80001,
    infura: "https://rpc-mumbai.maticvigil.com/",
    etherscan: "https://testnet.ftmscan.com",
    addresses: {
        GatewayRegistry: "0xD881213F5ABF783d93220e6bD3Cc21706A8dc1fC",
        BasicAdapter: "0xD087b0540e172553c12DEEeCDEf3dFD21Ec02066",
    },
};

export const renPolygonMainnet: EthereumConfig = {
    name: "Polygon Mainnet",
    chain: "polygonMainnet",
    isTestnet: false,
    chainLabel: "Polygon Mainnet",
    networkID: 137,
    infura: "https://rpc-mainnet.maticvigil.com/",
    etherscan: "https://explorer.matic.network",
    addresses: {
        GatewayRegistry: "0x21C482f153D0317fe85C60bE1F7fa079019fcEbD",
        BasicAdapter: "0xAC23817f7E9Ec7EB6B7889BDd2b50e04a44470c5",
    },
};

export const PolygonConfigMap = {
    [RenNetwork.TestnetVDot3]: renPolygonTestnet,
    [RenNetwork.MainnetVDot3]: renPolygonMainnet,
};

const resolvePolygonNetwork = (
    renNetwork?:
        | RenNetwork
        | RenNetworkString
        | RenNetworkDetails
        | EthereumConfig,
) => {
    if (!renNetwork) {
        return PolygonConfigMap[RenNetwork.MainnetVDot3];
    }
    if ((renNetwork as EthereumConfig).addresses) {
        return renNetwork as EthereumConfig;
    } else {
        const details = getRenNetworkDetails(
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

    public static utils = {
        resolveChainNetwork: resolvePolygonNetwork,
        addressIsValid,
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
            }/tx/${transaction}`,
    };

    public utils = utilsWithChainNetwork(
        PolygonClass.utils,
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
        super(web3Provider, resolvePolygonNetwork(renNetwork));
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
