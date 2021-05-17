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

export const renFantomTestnet: EthereumConfig = {
    name: "Fantom Testnet",
    chain: "fantomTestnet",
    isTestnet: true,
    chainLabel: "Fantom Testnet",
    networkID: 0xfa2,
    infura: "https://rpc.testnet.fantom.network/",
    etherscan: "https://testnet.ftmscan.com",
    addresses: {
        GatewayRegistry: "0x838F881876f53a772D2F8E2f8aa2e4a996431495",
        BasicAdapter: "0x7de1253A8da6620351ec477b38BdC6a55FCd0f85",
    },
};

export const renFantomDevnet: EthereumConfig = {
    ...renFantomTestnet,
    addresses: {
        GatewayRegistry: "0xD881213F5ABF783d93220e6bD3Cc21706A8dc1fC",
        BasicAdapter: "0x105435a9b0f375B179e5e43A16228C04F01Fb2ee",
    },
};

export const renFantomMainnet: EthereumConfig = {
    name: "Fantom Mainnet",
    chain: "fantomMainnet",
    isTestnet: false,
    chainLabel: "Fantom Mainnet",
    networkID: 250,
    infura: "https://rpcapi.fantom.network/",
    etherscan: "https://ftmscan.com",
    addresses: {
        GatewayRegistry: "0x21C482f153D0317fe85C60bE1F7fa079019fcEbD",
        BasicAdapter: "0xAC23817f7E9Ec7EB6B7889BDd2b50e04a44470c5",
    },
};

export const FantomConfigMap = {
    [RenNetwork.TestnetVDot3]: renFantomTestnet,
    [RenNetwork.MainnetVDot3]: renFantomMainnet,
    [RenNetwork.DevnetVDot3]: renFantomDevnet,
};

const resolveFantomNetwork = (
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
                ? renFantomDevnet
                : renFantomTestnet
            : renFantomMainnet;
    }
};

export class FantomClass extends EthereumClass {
    public static chain = "Fantom";
    public chain = FantomClass.chain;
    public name = FantomClass.chain;
    public legacyName = undefined;

    public static utils = {
        resolveChainNetwork: resolveFantomNetwork,
        addressIsValid,
        addressExplorerLink: (
            address: EthAddress,
            network: NetworkInput = renFantomMainnet,
        ): string =>
            `${
                (Fantom.utils.resolveChainNetwork(network) || renFantomMainnet)
                    .etherscan
            }/address/${address}`,

        transactionExplorerLink: (
            transaction: EthTransaction,
            network: NetworkInput = renFantomMainnet,
        ): string =>
            `${
                (Fantom.utils.resolveChainNetwork(network) || renFantomMainnet)
                    .etherscan
            }/tx/${transaction}`,
    };

    public utils = utilsWithChainNetwork(
        FantomClass.utils,
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
        super(web3Provider, resolveFantomNetwork(renNetwork));
    }

    initialize = (
        renNetwork: RenNetwork | RenNetworkString | RenNetworkDetails,
    ) => {
        this.renNetworkDetails =
            this.renNetworkDetails ||
            FantomConfigMap[getRenNetworkDetails(renNetwork).name];

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

export type Fantom = FantomClass;
// @dev Removes any static fields, except `utils`.
export const Fantom = Callable(FantomClass);
