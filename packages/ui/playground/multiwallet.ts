import { SolanaConnector } from "@renproject/multiwallet-solana-connector";
import { BinanceSmartChainInjectedConnector } from "../../lib/multiwallet/multiwallet-binancesmartchain-injected-connector/src/index";
import { EthereumInjectedConnector } from "../../lib/multiwallet/multiwallet-ethereum-injected-connector/src/index";
/* import { EthereumMEWConnectConnector } from "../../lib/multiwallet/multiwallet-ethereum-mewconnect-connector/src/index";
 * import { EthereumWalletConnectConnector } from "../../lib/multiwallet/multiwallet-ethereum-walletconnect-connector/src/index"; */
import { WalletPickerConfig } from "../multiwallet-ui";
import { RenNetwork } from "@renproject/interfaces";

export const multiwalletOptions: WalletPickerConfig<unknown, string> = {
    chains: {
        solana: [
            {
                name: "Sollet.io",
                logo:
                    "https://avatars1.githubusercontent.com/u/69240779?s=60&v=4",
                connector: new SolanaConnector({
                    debug: true,
                    providerURL: "https://www.sollet.io",
                    network: RenNetwork.DevnetVDot3,
                }),
            },
        ],
        moonbeam: [
            {
                name: "Metamask",
                logo:
                    "https://avatars1.githubusercontent.com/u/11744586?s=60&v=4",
                connector: new EthereumInjectedConnector({
                    debug: true,
                    networkIdMapper: () => RenNetwork.Testnet,
                }),
            },
        ],
        polygon: [
            {
                name: "Metamask",
                logo:
                    "https://avatars1.githubusercontent.com/u/11744586?s=60&v=4",
                connector: new EthereumInjectedConnector({
                    debug: true,
                    networkIdMapper: () => RenNetwork.Testnet,
                }),
            },
        ],
        fantom: [
            {
                name: "Metamask",
                logo:
                    "https://avatars1.githubusercontent.com/u/11744586?s=60&v=4",
                connector: new EthereumInjectedConnector({
                    debug: true,
                    networkIdMapper: () => RenNetwork.Testnet,
                }),
            },
        ],
        ethereum: [
            {
                name: "Metamask",
                logo:
                    "https://avatars1.githubusercontent.com/u/11744586?s=60&v=4",
                connector: new EthereumInjectedConnector({
                    debug: true,
                    networkIdMapper: () => RenNetwork.Testnet,
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
        bsc: [
            {
                name: "BinanceSmartWallet",
                logo:
                    "https://avatars2.githubusercontent.com/u/45615063?s=60&v=4",
                connector: new BinanceSmartChainInjectedConnector({
                    debug: true,
                }),
            },
        ],
    },
};
