import { chaosnet, devnet, localnet, mainnet, testnet } from "@renproject/contracts";
import { RenNetwork } from "@renproject/interfaces";

// import { Networks as ZNetworks } from "bitcore-lib-zcash";

export interface NetworkDetails {
    name: string;
    nodeURLs: string[];
    isTestnet: boolean;
    ethNetwork: string;

    mercuryURL: {
        btc: string,
        zec: string,
        bch: string,
    };
    chainSoName: {
        btc: string,
        zec: string,
        bch: string,
    };
    contracts: typeof mainnet | typeof chaosnet | typeof testnet | typeof devnet | typeof localnet;
}

// Configurations shared by Mainnet and Chaosnet
const commonMainConfig = {
    ethNetwork: "mainnet",
    isTestnet: false,
    mercuryURL: {
        // tslint:disable-next-line: no-http-string
        btc: "http://139.59.217.120:5000/btc/mainnet",
        // tslint:disable-next-line: no-http-string
        zec: "http://139.59.217.120:5000/zec/mainnet",
        // tslint:disable-next-line: no-http-string
        bch: "http://139.59.217.120:5000/bch/mainnet",
    },
    chainSoName: {
        btc: "BTC",
        zec: "ZEC",
        bch: "BCH",
    },
};

export const NetworkChaosnet: NetworkDetails = {
    name: RenNetwork.Chaosnet,
    nodeURLs: ["https://lightnode-chaosnet.herokuapp.com"],
    ...commonMainConfig,
    contracts: chaosnet,
};

export const NetworkMainnet: NetworkDetails = {
    name: RenNetwork.Mainnet,
    nodeURLs: ["https://lightnode-mainnet.herokuapp.com"],
    ...commonMainConfig,
    contracts: mainnet,
};

// Configurations shared by Testnet and Devnet
const commonTestConfig = {
    ethNetwork: "kovan",
    isTestnet: true,
    mercuryURL: {
        // tslint:disable-next-line: no-http-string
        btc: "http://139.59.217.120:5000/btc/testnet",
        // tslint:disable-next-line: no-http-string
        zec: "http://139.59.217.120:5000/zec/testnet",
        // tslint:disable-next-line: no-http-string
        bch: "http://139.59.217.120:5000/bch/testnet",
    },
    chainSoName: {
        btc: "BTCTEST",
        zec: "ZECTEST",
        bch: "BCHTEST",
    },
};

export const NetworkTestnet: NetworkDetails = {
    name: RenNetwork.Testnet,
    nodeURLs: ["https://lightnode-testnet.herokuapp.com"],
    ...commonTestConfig,
    contracts: testnet,
};

const USE_DEVNET_NODES = false;
const devnetNodes = [
    "/ip4/159.203.5.109/tcp/18514/ren/8MKEFLAciYAgUsR4hG45oczthywtfo",
    "/ip4/67.207.83.83/tcp/18514/ren/8MJ6zb2jeGvneG2b3cxRzie7StTHcq",
    "/ip4/134.209.84.230/tcp/18514/ren/8MHMb2j7zacAMw8Wzvn2QBojDqwo52",
    "/ip4/178.128.239.168/tcp/18514/ren/8MHhMWw8GeFxenczz2n23kMJkZg6xS",
    "/ip4/159.203.90.81/tcp/18514/ren/8MJJoxU42DG3v42jke7CwSLHXmvWA3",
    "/ip4/138.68.245.91/tcp/18514/ren/8MGpj1s5zg8sXhHpbDurdCMnERGezW",
    "/ip4/209.97.142.95/tcp/18514/ren/8MHBnQx4ftSrSLvQNBdrxjkbr34KTk",
    "/ip4/134.209.104.180/tcp/18514/ren/8MHRw1K57vFcYzTs6xiTiYs2iwxQX7",
    "/ip4/68.183.198.209/tcp/18514/ren/8MHVWUvxEyq3i6vUCmVez5HafDATtR",
    "/ip4/178.62.61.84/tcp/18514/ren/8MHXKcMVNEgo75FsbckSjnsrzmW2oi",
    "/ip4/178.128.241.255/tcp/18514/ren/8MJnxv8Uy3VzaWkeTXwhJ5pySRh6KW",
    "/ip4/178.62.120.202/tcp/18514/ren/8MJNcWGagTSTJtJWejrLFucMW21M8J",
];

export const NetworkDevnet: NetworkDetails = {
    name: RenNetwork.Devnet,
    nodeURLs: USE_DEVNET_NODES ? devnetNodes : ["https://lightnode-devnet.herokuapp.com"],
    ...commonTestConfig,
    contracts: devnet,
};

const localnetCount = 12;
const localnetProtocol = "http";
export const NetworkLocalnet: NetworkDetails = {
    name: RenNetwork.Localnet,
    nodeURLs: Array.from(Array(localnetCount)).map((_, index) => `${localnetProtocol}://0.0.0.0:${6001 + 10 * index}`),
    ...commonTestConfig,
    contracts: localnet,
};

export const stringToNetwork = (network?: NetworkDetails | string | null | undefined): NetworkDetails => {
    if (typeof network === "string") {
        switch (network.toLowerCase()) {
            case "":
            case "mainnet":
                // return NetworkMainnet;
                throw new Error("Mainnet is not supported yet.");
            case "chaosnet":
                return NetworkChaosnet;
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
        // return NetworkChaosnet;
        throw new Error("Mainnet is not supported yet.");
    } else {
        return network;
    }
};
