import { SolanaConnector } from "../../lib/multiwallet/multiwallet-solana-connector/src/index";
import { BinanceSmartChainInjectedConnector } from "../../lib/multiwallet/multiwallet-binancesmartchain-injected-connector/src/index";
import { EthereumInjectedConnector } from "../../lib/multiwallet/multiwallet-ethereum-injected-connector/src/index";
/* import { EthereumMEWConnectConnector } from "../../lib/multiwallet/multiwallet-ethereum-mewconnect-connector/src/index";
 * import { EthereumWalletConnectConnector } from "../../lib/multiwallet/multiwallet-ethereum-walletconnect-connector/src/index"; */
import { WalletPickerConfig } from "../multiwallet-ui";
import { RenNetwork } from "@renproject/interfaces";

const networkMapping: Record<number, RenNetwork[]> = {
    1: [RenNetwork.Mainnet],
    42: [RenNetwork.Testnet],
};

export const renNetworkToEthNetwork = (id: RenNetwork): number | undefined => {
    const entry = Object.entries(networkMapping).find(([_, x]) =>
        x.includes(id),
    );
    if (!entry) return entry;
    return parseInt(entry[0]);
};

export const ethNetworkToRenNetwork = (id: string | number): RenNetwork => {
    return {
        "1": RenNetwork.Mainnet,
        "42": RenNetwork.Testnet,
    }[parseInt(id as string).toString() as "1" | "42"];
};

export const fantomNetworkToRenNetwork = (id: string | number): RenNetwork => {
    return {
        "250": RenNetwork.Mainnet,
        "4002": RenNetwork.Testnet,
    }[parseInt(id as string).toString() as "250" | "4002"];
};
export const polygonNetworkToRenNetwork = (id: string | number): RenNetwork => {
    return {
        "137": RenNetwork.Mainnet,
        "80001": RenNetwork.Testnet,
    }[parseInt(id as string).toString() as "137" | "80001"];
};
export const avalancheNetworkToRenNetwork = (
    id: string | number,
): RenNetwork => {
    return {
        "43114": RenNetwork.Mainnet,
        "43113": RenNetwork.Testnet,
    }[parseInt(id as string).toString() as "43114" | "43113"];
};

export const multiwalletOptions = (
    network: RenNetwork,
): WalletPickerConfig<unknown, string> => ({
    chains: {
        avalance: [
            {
                name: "Metamask",
                logo: "https://avatars2.githubusercontent.com/u/45615063?s=60&v=4",
                connector: (() => {
                    const connector = new EthereumInjectedConnector({
                        networkIdMapper: avalancheNetworkToRenNetwork,
                        debug: true,
                    });
                    connector.getProvider = () => (window as any).ethereum;
                    return connector;
                })(),
            },
        ],
        solana: [
            {
                name: "Sollet.io",
                logo: "https://avatars1.githubusercontent.com/u/69240779?s=60&v=4",
                connector: new SolanaConnector({
                    debug: true,
                    providerURL: "https://www.sollet.io",
                    network,
                }),
            },
            {
                name: "Phantom",
                logo: "https://avatars1.githubusercontent.com/u/78782331?s=60&v=4",
                connector: new SolanaConnector({
                    debug: true,
                    providerURL: (window as any).solana,
                    network,
                }),
            },
        ],
        moonbeam: [
            {
                name: "Metamask",
                logo: "https://avatars1.githubusercontent.com/u/11744586?s=60&v=4",
                connector: new EthereumInjectedConnector({
                    debug: true,
                    networkIdMapper: () => RenNetwork.Testnet,
                }),
            },
        ],
        polygon: [
            {
                name: "Metamask",
                logo: "https://avatars1.githubusercontent.com/u/11744586?s=60&v=4",
                connector: new EthereumInjectedConnector({
                    debug: true,
                    networkIdMapper: polygonNetworkToRenNetwork,
                }),
            },
        ],
        fantom: [
            {
                name: "Metamask",
                logo: "https://avatars1.githubusercontent.com/u/11744586?s=60&v=4",
                connector: new EthereumInjectedConnector({
                    debug: true,
                    networkIdMapper: fantomNetworkToRenNetwork,
                }),
            },
        ],
        ethereum: [
            {
                name: "Metamask",
                logo: "https://avatars1.githubusercontent.com/u/11744586?s=60&v=4",
                connector: new EthereumInjectedConnector({
                    debug: true,
                    networkIdMapper: ethNetworkToRenNetwork,
                }),
            },
            /* {
             *     name: "WalletConnect",
             *     logo:
             *         "https://avatars0.githubusercontent.com/u/37784886?s=60&v=4",
             *     connector: new EthereumWalletConnectConnector({
             *         rpc: {
             *             1: `https://mainnet.infura.io/v3/${INFURA_PROJECT_ID}`,
             *             42: `https://kovan.infura.io/v3/${INFURA_PROJECT_ID}`,
             *         },
             *         qrcode: true,
             *         debug: true,
             *     }),
             * }, */
            /* {
             *     name: "MEW",
             *     logo:
             *         "https://avatars0.githubusercontent.com/u/24321658?s=60&v=4",
             *     connector: new EthereumMEWConnectConnector({
             *         rpc: {
             *             1: `wss://mainnet.infura.io/ws/v3/${INFURA_PROJECT_ID}`,
             *             42: `wss://kovan.infura.io/ws/v3/${INFURA_PROJECT_ID}`,
             *         },
             *         chainId: 42,
             *         debug: true,
             *     }),
             * }, */
        ],
        binanceSmartChain: [
            {
                name: "BinanceSmartWallet",
                logo: "https://avatars2.githubusercontent.com/u/45615063?s=60&v=4",
                connector: new BinanceSmartChainInjectedConnector({
                    debug: true,
                }),
            },
        ],
    },
});
