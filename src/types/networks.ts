import { devnet, localnet, mainnet, testnet } from "@renproject/contracts";
import { Networks as BNetworks } from "bitcore-lib";
import { Networks as ZNetworks } from "bitcore-lib-zcash";
import { List } from "immutable";

export enum Network {
    Mainnet = "mainnet",
    Testnet = "testnet",
    Devnet = "devnet",
    Localnet = "localnet",
}

export interface NetworkDetails {
    name: string;
    nodeURLs: string[];

    mercuryURL: {
        btc: string,
        zec: string,
    };
    chainSoName: {
        btc: string,
        zec: string,
    };
    chainSoURL: string;
    bitcoinNetwork: BNetworks.Network;
    zcashNetwork: ZNetworks.Network;
    contracts: typeof mainnet | typeof testnet | typeof devnet | typeof localnet;
}

export const NetworkMainnet: NetworkDetails = {
    name: Network.Mainnet,
    nodeURLs: [""],
    mercuryURL: {
        btc: "",
        zec: "",
    },
    chainSoName: {
        btc: "",
        zec: "",
    },
    chainSoURL: "",

    bitcoinNetwork: BNetworks.mainnet,
    zcashNetwork: ZNetworks.mainnet,
    contracts: mainnet,
};

// Configurations shared by Testnet and Devnet
const commonTestConfig = {
    mercuryURL: {
        btc: "https://ren-mercury.herokuapp.com/btc-testnet3",
        zec: "https://ren-mercury.herokuapp.com/zec-testnet",
    },
    chainSoName: {
        btc: "BTCTEST",
        zec: "ZECTEST",
    },
    bitcoinNetwork: BNetworks.testnet,
    zcashNetwork: ZNetworks.testnet,
    chainSoURL: "https://chain.so/api/v2",
};

export const NetworkTestnet: NetworkDetails = {
    name: Network.Testnet,
    nodeURLs: ["https://lightnode-testnet.herokuapp.com"],
    ...commonTestConfig,
    contracts: testnet,
};

const USE_DEVNET_NODES = true;
const devnetNodes = [
    "/ip4/209.97.142.95/tcp/18514/ren/8MG4nwPYD1QNuDopWQ4GGkp9AGEo4k",
    "/ip4/159.203.5.109/tcp/18514/ren/8MKEFLAciYAgUsR4hG45oczthywtfo",
    "/ip4/134.209.84.230/tcp/18514/ren/8MGtTtKPra8LNR4tG3GBx4x5hwMAaW",
    "/ip4/67.207.83.83/tcp/18514/ren/8MJ6zb2jeGvneG2b3cxRzie7StTHcq",
    "/ip4/68.183.198.209/tcp/18514/ren/8MH533YDaCZPjEYDYbghyoBV48Tw8e",
    "/ip4/134.209.84.230/tcp/18514/ren/8MHMb2j7zacAMw8Wzvn2QBojDqwo52",
    "/ip4/178.62.61.84/tcp/18514/ren/8MHEwdUuHqA4DDmdQYDFwp1BXkwQuY",
    "/ip4/178.128.239.168/tcp/18514/ren/8MHhMWw8GeFxenczz2n23kMJkZg6xS",
    "/ip4/178.128.241.255/tcp/18514/ren/8MG6FdYax3TCAgcAgqJCzaLwrU8o4f",
    "/ip4/159.203.90.81/tcp/18514/ren/8MJJoxU42DG3v42jke7CwSLHXmvWA3",
    "/ip4/178.62.120.202/tcp/18514/ren/8MJUXJVnnjmZWzmdkQLcsUhAsRpGYa",
    "/ip4/138.68.245.91/tcp/18514/ren/8MGpj1s5zg8sXhHpbDurdCMnERGezW",
];

export const NetworkDevnet: NetworkDetails = {
    name: Network.Devnet,
    nodeURLs: USE_DEVNET_NODES ? devnetNodes : ["https://lightnode-devnet.herokuapp.com"],
    ...commonTestConfig,
    contracts: devnet,
};

const localnetCount = 12;
const localnetProtocol = "http";
export const NetworkLocalnet: NetworkDetails = {
    name: Network.Localnet,
    nodeURLs: List(Array(localnetCount)).map((_, index) => `${localnetProtocol}://0.0.0.0:${6001 + 10 * index}`).toArray(),
    ...commonTestConfig,
    contracts: localnet,
};

export const stringToNetwork = (network?: NetworkDetails | string | null | undefined): NetworkDetails => {
    if (typeof network === "string") {
        switch (network.toLowerCase()) {
            case "":
            case "mainnet":
                return NetworkMainnet;
            case "testnet":
                return NetworkTestnet;
            case "devnet":
                return NetworkDevnet;
            case "localnet":
                return NetworkLocalnet;
            default:
                throw new Error(`Unsupported network "${network}"`);
        }
    } else if (network === undefined || network === null) {
        return NetworkMainnet;
    } else {
        return network;
    }
};
