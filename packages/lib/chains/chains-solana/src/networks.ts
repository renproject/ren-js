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
        case RenNetwork.Mainnet:
        case RenNetwork.MainnetVDot3:
            return renMainnet;
        case RenNetwork.Testnet:
        case RenNetwork.TestnetVDot3:
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
    endpoint: "https://testnet.solana.com",
    chainExplorer: "https://explorer.solana.com/",
    addresses: {
        GatewayRegistry: "",
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
        GatewayRegistry: "5adtAdnnEWVBXyxW1osiDDAHF9NPkNFVvezU4RWyWukc",
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
        GatewayRegistry: "5adtAdnnEWVBXyxW1osiDDAHF9NPkNFVvezU4RWyWukc",
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
        GatewayRegistry: "DHpzwsdvAzq61PN9ZwQWg2hzwX8gYNfKAdsNKKtdKDux",
    },
    genesisHash: "",
};
