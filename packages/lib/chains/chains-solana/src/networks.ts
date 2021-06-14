import {
    RenNetwork,
    RenNetworkDetails,
    RenNetworkString,
} from "@renproject/interfaces";

export interface SolNetworkConfig {
    name: RenNetwork;
    chain: string;
    isTestnet: boolean;
    chainLabel: string;
    chainExplorer: string;
    endpoint: string;
    addresses: {
        GatewayRegistry: string;
    };
    // used for identifying the network (similar to chainID in eth)
    genesisHash: string;
}

const isSolNetworkConfig = (
    x: RenNetworkDetails | SolNetworkConfig,
): x is SolNetworkConfig => {
    return (x as SolNetworkConfig).genesisHash !== undefined;
};

export const resolveNetwork = (
    renNetwork:
        | RenNetwork
        | RenNetworkString
        | RenNetworkDetails
        | SolNetworkConfig,
) => {
    let networkString = "";
    if (typeof renNetwork !== "string") {
        if (isSolNetworkConfig(renNetwork)) {
            return renNetwork;
        } else {
            networkString = renNetwork.name;
        }
    } else {
        networkString = renNetwork;
    }

    switch (networkString) {
        case RenNetwork.MainnetVDot3:
        case RenNetwork.Mainnet:
            return renMainnet;
        case RenNetwork.TestnetVDot3:
        case RenNetwork.Testnet:
            return renTestnet;
        case RenNetwork.DevnetVDot3:
            return renDevnet;
    }

    return renLocalnet;
};

export const renMainnet: SolNetworkConfig = {
    name: RenNetwork.MainnetVDot3,
    chain: "mainnet",
    isTestnet: false,
    chainLabel: "Mainnet",
    endpoint: "https://ren.rpcpool.com/",
    chainExplorer: "https://explorer.solana.com/",
    addresses: {
        GatewayRegistry: "REGrPFKQhRneFFdUV3e9UDdzqUJyS6SKj88GdXFCRd2",
    },
    genesisHash: "5eykt4UsFv8P8NJdTREpY1vzqKqZKvdpKuc147dw2N9d",
};

export const renTestnet: SolNetworkConfig = {
    name: RenNetwork.TestnetVDot3,
    chain: "testnet",
    isTestnet: true,
    chainLabel: "Testnet",
    endpoint: "https://testnet.solana.com",
    chainExplorer: "https://explorer.solana.com/",
    addresses: {
        GatewayRegistry: "REGrPFKQhRneFFdUV3e9UDdzqUJyS6SKj88GdXFCRd2",
    },
    genesisHash: "4uhcVJyU9pJkvQyS88uRDiswHXSCkY3zQawwpjk2NsNY",
};

export const renDevnet: SolNetworkConfig = {
    name: RenNetwork.DevnetVDot3,
    chain: "devnet",
    isTestnet: true,
    chainLabel: "Devnet",
    endpoint: "https://api.devnet.solana.com",
    chainExplorer: "https://explorer.solana.com/",
    addresses: {
        GatewayRegistry: "REGrPFKQhRneFFdUV3e9UDdzqUJyS6SKj88GdXFCRd2",
    },
    genesisHash: "EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG",
};

export const renLocalnet: SolNetworkConfig = {
    name: RenNetwork.Localnet,
    chain: "localnet",
    isTestnet: true,
    chainLabel: "",
    endpoint: "http://0.0.0.0:8899",
    chainExplorer: "https://explorer.solana.com/",
    addresses: {
        GatewayRegistry: "REGrPFKQhRneFFdUV3e9UDdzqUJyS6SKj88GdXFCRd2",
    },
    genesisHash: "",
};
