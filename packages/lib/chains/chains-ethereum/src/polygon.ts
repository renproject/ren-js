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

export const renPolygonTestnet: EthereumConfig = {
    name: "Polygon Testnet",
    chain: "polygonTestnet",
    isTestnet: true,
    chainLabel: "Polygon Testnet",
    networkID: 80001,
    infura: "https://rpc-mumbai.maticvigil.com/",
    etherscan: "https://testnet.ftmscan.com",
    addresses: {
        GatewayRegistry: "0x838F881876f53a772D2F8E2f8aa2e4a996431495",
        BasicAdapter: "0x7de1253A8da6620351ec477b38BdC6a55FCd0f85",
    },
};

export const renPolygonDevnet: EthereumConfig = {
    ...renPolygonTestnet,
    addresses: {
        GatewayRegistry: "0x87e83f957a2F3A2E5Fe16d5C6B22e38FD28bdc06",
        BasicAdapter: "0x105435a9b0f375B179e5e43A16228C04F01Fb2ee",
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
    [RenNetwork.DevnetVDot3]: renPolygonDevnet,
};

const resolvePolygonNetwork = (
    renNetwork:
        | RenNetwork
        | RenNetworkString
        | RenNetworkDetails
        | EthereumConfig,
) => {
    if ((renNetwork as EthereumConfig).addresses) {
        return renNetwork as EthereumConfig;
    } else {
        const details = getRenNetworkDetails(
            renNetwork as RenNetwork | RenNetworkString | RenNetworkDetails,
        );
        return details.isTestnet
            ? details.name === RenNetwork.DevnetVDot3
                ? renPolygonDevnet
                : renPolygonTestnet
            : renPolygonMainnet;
    }
};

export class PolygonClass extends EthereumClass {
    public static chain = "Polygon";
    public chain = PolygonClass.chain;
    public name = PolygonClass.chain;
    public legacyName = undefined;

    public static utils = {
        resolveChainNetwork: resolvePolygonNetwork,
        addressIsValid,
        addressExplorerLink: (
            address: EthAddress,
            network: NetworkInput = renPolygonMainnet,
        ): string =>
            `${
                (
                    Polygon.utils.resolveChainNetwork(network) ||
                    renPolygonMainnet
                ).etherscan
            }/address/${address}`,

        transactionExplorerLink: (
            transaction: EthTransaction,
            network: NetworkInput = renPolygonMainnet,
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

    findTransaction = async (
        asset: string,
        nHash: Buffer,
        sigHash?: Buffer,
    ): Promise<EthTransaction | undefined> => {
        if (!this.renNetworkDetails || !this.web3) {
            throw new Error(
                `${this.name} object not initialized - must provide network to constructor.`,
            );
        }
        return findTransactionBySigHash(
            this.renNetworkDetails,
            this.web3,
            asset,
            nHash,
            sigHash,
            5000,
        );
    };
}

export type Polygon = PolygonClass;
// @dev Removes any static fields, except `utils`.
export const Polygon = Callable(PolygonClass);
