import {
    chaosnet, devnet, localnet, mainnet, RenNetworkDetails, testnet,
} from "@renproject/contracts";

export const stringToNetwork = (network?: RenNetworkDetails | string | null | undefined): RenNetworkDetails => {
    if (typeof network === "string") {
        switch (network.toLowerCase()) {
            case "":
            case "mainnet":
                return mainnet;
            case "chaosnet":
                return chaosnet;
            case "testnet":
                return testnet;
            case "devnet":
                return devnet;
            // case "localnet":
            //     return localnet;
            default:
                throw new Error(`Unsupported network "${network}"`);
        }
    } else if (network === undefined || network === null) {
        return mainnet;
    } else {
        return network;
    }
};

export interface NetworkDetails {
    Mainnet: typeof mainnet;
    Chaosnet: typeof chaosnet;
    Testnet: typeof testnet;
    Devnet: typeof devnet;
    Localnet: typeof localnet;
    stringToNetwork: typeof stringToNetwork;
}

export const NetworkDetails: NetworkDetails = {
    Mainnet: mainnet,
    Chaosnet: chaosnet,
    Testnet: testnet,
    Devnet: devnet,
    Localnet: localnet,

    stringToNetwork,
};
