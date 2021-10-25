import {
  getRenNetworkDetails,
  Logger,
  RenNetwork,
  RenNetworkDetails,
  RenNetworkString,
} from "@renproject/interfaces";
import { Callable, utilsWithChainNetwork } from "@renproject/utils";

import { NetworkInput } from "./base";
import { EthereumClass } from "./ethereum";
import { EthereumConfig, StandardExplorer } from "./networks";
import { EthAddress, EthProvider, EthTransaction } from "./types";
import { addressIsValid, transactionIsValid } from "./utils";

export const renAvalancheTestnet: EthereumConfig = {
    name: "Avalanche Testnet",
    chain: "avalancheTestnet",
    isTestnet: true,
    chainLabel: "Avalanche Testnet",
    networkID: 80001,
    addresses: {
        GatewayRegistry: "0xD881213F5ABF783d93220e6bD3Cc21706A8dc1fC",
        BasicAdapter: "0xD087b0540e172553c12DEEeCDEf3dFD21Ec02066",
    },

    publicProvider: () => `https://api.avax-test.network/ext/bc/C/rpc`,
    explorer: StandardExplorer("https://cchain.explorer.avax-test.network"),

    /** @deprecated Renamed to publicProvider. Will be removed in 3.0.0. */
    infura: "https://api.avax-test.network/ext/bc/C/rpc",
    /** @deprecated Renamed to explorer. Will be removed in 3.0.0. */
    etherscan: "https://cchain.explorer.avax-test.network",
};

export const renAvalancheMainnet: EthereumConfig = {
    name: "Avalanche Mainnet",
    chain: "avalancheMainnet",
    isTestnet: false,
    chainLabel: "Avalanche Mainnet",
    networkID: 43114,
    addresses: {
        GatewayRegistry: "0x21C482f153D0317fe85C60bE1F7fa079019fcEbD",
        BasicAdapter: "0xAC23817f7E9Ec7EB6B7889BDd2b50e04a44470c5",
    },

    publicProvider: () => `https://api.avax.network/ext/bc/C/rpc`,
    explorer: StandardExplorer("https://cchain.explorer.avax.network"),

    /** @deprecated Renamed to publicProvider. Will be removed in 3.0.0. */
    infura: "https://api.avax.network/ext/bc/C/rpc",
    /** @deprecated Renamed to explorer. Will be removed in 3.0.0. */
    etherscan: "https://cchain.explorer.avax.network",
};

export const AvalancheConfigMap = {
    [RenNetwork.Testnet]: renAvalancheTestnet,
    [RenNetwork.Mainnet]: renAvalancheMainnet,
};

const resolveAvalancheNetwork = (
    renNetwork?:
        | RenNetwork
        | RenNetworkString
        | RenNetworkDetails
        | EthereumConfig,
) => {
    if (!renNetwork) {
        return AvalancheConfigMap[RenNetwork.Mainnet];
    }
    if ((renNetwork as EthereumConfig).addresses) {
        return renNetwork as EthereumConfig;
    } else {
        const details = getRenNetworkDetails(
            // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
            renNetwork as RenNetwork | RenNetworkString | RenNetworkDetails,
        );
        return details.isTestnet ? renAvalancheTestnet : renAvalancheMainnet;
    }
};

export class AvalancheClass extends EthereumClass {
    public static chain = "Avalanche";
    public chain = AvalancheClass.chain;
    public name = AvalancheClass.chain;
    public legacyName = undefined;
    // public logRequestLimit = 1000;

    public static configMap = AvalancheConfigMap;
    public configMap = AvalancheConfigMap;

    public static utils = {
        resolveChainNetwork: resolveAvalancheNetwork,
        addressIsValid,
        transactionIsValid,
        addressExplorerLink: (
            address: EthAddress,
            network?: NetworkInput,
        ): string =>
            `${
                (
                    Avalanche.utils.resolveChainNetwork(network) ||
                    renAvalancheMainnet
                ).etherscan
            }/address/${address}`,

        transactionExplorerLink: (
            transaction: EthTransaction,
            network?: NetworkInput,
        ): string =>
            `${
                (
                    Avalanche.utils.resolveChainNetwork(network) ||
                    renAvalancheMainnet
                ).etherscan
            }/tx/${transaction || ""}`,
    };

    public utils = utilsWithChainNetwork(
        AvalancheClass.utils,
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
        super(web3Provider, resolveAvalancheNetwork(renNetwork), config);
    }

    initialize = (
        renNetwork: RenNetwork | RenNetworkString | RenNetworkDetails,
    ) => {
        this.renNetworkDetails =
            this.renNetworkDetails ||
            AvalancheConfigMap[getRenNetworkDetails(renNetwork).name];

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

export type Avalanche = AvalancheClass;
// @dev Removes any static fields, except `utils`.
export const Avalanche = Callable(AvalancheClass);
