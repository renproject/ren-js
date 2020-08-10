import {
    renChaosnet,
    renDevnet,
    renLocalnet,
    renMainnet,
    RenNetworkDetails,
    renTestnet,
} from "@renproject/contracts";

export const stringToNetwork = (
    network?: RenNetworkDetails | string | null | undefined,
): RenNetworkDetails => {
    if (typeof network === "string") {
        switch (network.toLowerCase()) {
            case "":
            case "mainnet":
                return renMainnet;
            case "chaosnet":
                return renChaosnet;
            case "testnet":
                return renTestnet;
            case "devnet":
                return renDevnet;
            // case "localnet":
            //     return localnet;
            default:
                throw new Error(`Unsupported network "${network}"`);
        }
    } else if (network === undefined || network === null) {
        return renMainnet;
    } else {
        return network;
    }
};

export interface NetworkDetails {
    Mainnet: typeof renMainnet;
    Chaosnet: typeof renChaosnet;
    Testnet: typeof renTestnet;
    Devnet: typeof renDevnet;
    Localnet: typeof renLocalnet;
    stringToNetwork: typeof stringToNetwork;
}

export const NetworkDetails: NetworkDetails = {
    Mainnet: renMainnet,
    Chaosnet: renChaosnet,
    Testnet: renTestnet,
    Devnet: renDevnet,
    Localnet: renLocalnet,

    stringToNetwork,
};
