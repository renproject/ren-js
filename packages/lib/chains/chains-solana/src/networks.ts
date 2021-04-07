import {
    RenNetwork,
    RenNetworkDetails,
    RenNetworkString,
} from "@renproject/interfaces";

export interface SolNetworkConfig {
    name: string;
    chain: string;
    isTestnet: boolean;
    networkID: number;
    chainLabel: string;
    chainExplorer: string;
    endpoint: string;
    addresses: {
        GatewayRegistry: string;
        BasicAdapter: string;
    };
}

export const resolveNetwork = (
    renNetwork:
        | RenNetwork
        | RenNetworkString
        | RenNetworkDetails
        | SolNetworkConfig,
) => {
    switch (renNetwork) {
        case RenNetwork.Mainnet:
            return renMainnet;
        case RenNetwork.Testnet:
            return renTestnet;
        case RenNetwork.DevnetVDot3:
            return renDevnet;
    }
    return renLocalnet;
};

export const renMainnet: SolNetworkConfig = {
    name: "mainnet",
    chain: "mainnet",
    isTestnet: false,
    networkID: 1,
    chainLabel: "Mainnet",
    chainExplorer: "https://explorer.solana.com/",
    endpoint: "https://testnet.solana.com",
    addresses: {
        GatewayRegistry: "",
        BasicAdapter: "",
    },
};

export const renTestnet: SolNetworkConfig = {
    name: "testnet",
    chain: "testnet",
    isTestnet: true,
    networkID: 2,
    chainLabel: "Testnet",
    endpoint: "https://testnet.solana.com",
    chainExplorer: "https://explorer.solana.com/",
    addresses: {
        GatewayRegistry: "3cvX9BpLMJsFTuEWSQBaTcd4TXgAmefqgNSJbufpyWyz",
        BasicAdapter: "9TaQuUfNMC5rFvdtzhHPk84WaFH3SFnweZn4tw9RriDP",
    },
};

export const renDevnet: SolNetworkConfig = {
    name: "devnet",
    chain: "devnet",
    isTestnet: true,
    networkID: 2,
    chainLabel: "Devnet",
    endpoint: "https://api.devnet.solana.com",
    chainExplorer: "https://explorer.solana.com/",
    addresses: {
        GatewayRegistry: "5adtAdnnEWVBXyxW1osiDDAHF9NPkNFVvezU4RWyWukc",
        BasicAdapter: "9TaQuUfNMC5rFvdtzhHPk84WaFH3SFnweZn4tw9RriDP",
    },
};

export const renLocalnet: SolNetworkConfig = {
    name: "localnet",
    chain: "localnet",
    isTestnet: true,
    networkID: 1,
    chainLabel: "",
    endpoint: "http://0.0.0.0:8899",
    chainExplorer: "https://explorer.solana.com/",
    addresses: {
        GatewayRegistry: "DHpzwsdvAzq61PN9ZwQWg2hzwX8gYNfKAdsNKKtdKDux",
        BasicAdapter: "FDdKRjbBeFtyu5c66cZghJsTTjDTT1aD3zsgTWMTpaif",
    },
};
