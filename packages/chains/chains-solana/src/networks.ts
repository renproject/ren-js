import { RenNetwork } from "@renproject/utils";

export interface SolNetworkConfig {
    name: RenNetwork;
    symbol: string;
    chain: string;
    isTestnet?: boolean;
    chainLabel: string;

    nativeAsset: {
        name: string;
        symbol: string;
        decimals: number;
    };
    averageConfirmationTime: number;

    chainExplorer: string;
    endpoint: string;
    addresses: {
        GatewayRegistry: string;
    };
    // used for identifying the network (similar to chainID in eth)
    genesisHash: string;
}

const isSolNetworkConfig = (x: unknown): x is SolNetworkConfig =>
    (x as SolNetworkConfig).genesisHash !== undefined;

export const resolveNetwork = (
    networkInput: RenNetwork | `${RenNetwork}` | SolNetworkConfig,
): SolNetworkConfig => {
    if (typeof networkInput === "string") {
        switch (networkInput) {
            case RenNetwork.Mainnet:
                return renMainnet;
            case RenNetwork.Testnet:
                return renTestnet;
        }
        throw new Error(`Unrecognized solana network ${networkInput}.`);
    }
    if (isSolNetworkConfig(networkInput)) {
        return networkInput;
    }
    // TODO: Throw better error and point out any missing fields.
    throw new Error(
        `Unrecognized solana network configuration (${String(networkInput)}).`,
    );
};

export const renMainnet: SolNetworkConfig = {
    name: RenNetwork.Mainnet,
    symbol: "SOL",
    chain: "mainnet-beta",
    chainLabel: "Mainnet Beta",

    nativeAsset: {
        name: "Solana",
        symbol: "SOL",
        decimals: 18,
    },
    averageConfirmationTime: 0.5,

    endpoint: "https://ren.rpcpool.com/",
    chainExplorer: "https://explorer.solana.com",
    addresses: {
        GatewayRegistry: "REGrPFKQhRneFFdUV3e9UDdzqUJyS6SKj88GdXFCRd2",
    },
    genesisHash: "5eykt4UsFv8P8NJdTREpY1vzqKqZKvdpKuc147dw2N9d",
};

export const renTestnet: SolNetworkConfig = {
    name: RenNetwork.Testnet,
    symbol: "SOL",
    chain: "devnet",
    isTestnet: true,
    chainLabel: "Devnet",

    nativeAsset: {
        name: "Solana",
        symbol: "SOL",
        decimals: 18,
    },
    averageConfirmationTime: 0.5,

    endpoint: "https://api.devnet.solana.com",
    chainExplorer: "https://explorer.solana.com",
    addresses: {
        GatewayRegistry: "REGrPFKQhRneFFdUV3e9UDdzqUJyS6SKj88GdXFCRd2",
    },
    genesisHash: "EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG",
};
