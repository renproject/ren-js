import { RenNetwork } from "@renproject/utils";

import { EthereumBaseChain } from "./base";
import { resolveEVMNetworkConfig } from "./utils/generic";

const configMap: EthereumBaseChain["configMap"] = {
    [RenNetwork.Mainnet]: {
        selector: "BinanceSmartChain",

        nativeAsset: {
            name: "Binance Coin",
            symbol: "BNB",
            decimals: 18,
        },
        averageConfirmationTime: 3,

        config: {
            chainId: "0x38",
            chainName: "Binance Smart Chain Mainnet",
            nativeCurrency: {
                name: "Binance Chain Native Token",
                symbol: "BNB",
                decimals: 18,
            },
            rpcUrls: [
                "https://bsc-dataseed1.binance.org",
                "https://bsc-dataseed2.binance.org",
                "https://bsc-dataseed3.binance.org",
                "https://bsc-dataseed4.binance.org",
                "https://bsc-dataseed1.defibit.io",
                "https://bsc-dataseed2.defibit.io",
                "https://bsc-dataseed3.defibit.io",
                "https://bsc-dataseed4.defibit.io",
                "https://bsc-dataseed1.ninicoin.io",
                "https://bsc-dataseed2.ninicoin.io",
                "https://bsc-dataseed3.ninicoin.io",
                "https://bsc-dataseed4.ninicoin.io",
                "wss://bsc-ws-node.nariox.org",
                "https://bsc-dataseed.binance.org",
                "https://rpc.ankr.com/bsc",
                "https://bscrpc.com",
                "https://bsc.mytokenpocket.vip",
                "https://binance.nodereal.io",
                "https://rpc-bsc.bnb48.club",
            ],
            blockExplorerUrls: ["https://bscscan.com"],
        },

        logRequestLimit: 5000,
        addresses: {
            GatewayRegistry: "0xf36666C230Fa12333579b9Bd6196CB634D6BC506",
            BasicBridge: "0x82DF02A52E2e76C0c233367f2fE6c9cfe51578c5",
        },
    },

    [RenNetwork.Testnet]: {
        selector: "BinanceSmartChain",
        isTestnet: true,

        nativeAsset: {
            name: "Testnet Binance Coin",
            symbol: "BNB",
            decimals: 18,
        },
        averageConfirmationTime: 3,

        config: {
            chainId: "0x61",
            chainName: "Binance Smart Chain Testnet",
            nativeCurrency: {
                name: "Binance Chain Native Token",
                symbol: "tBNB",
                decimals: 18,
            },
            rpcUrls: [
                "https://data-seed-prebsc-1-s1.binance.org:8545",
                "https://data-seed-prebsc-2-s1.binance.org:8545",
                "https://data-seed-prebsc-1-s2.binance.org:8545",
                "https://data-seed-prebsc-2-s2.binance.org:8545",
                "https://data-seed-prebsc-1-s3.binance.org:8545",
                "https://data-seed-prebsc-2-s3.binance.org:8545",
            ],
            blockExplorerUrls: ["https://testnet.bscscan.com"],
        },

        logRequestLimit: 5000,
        addresses: {
            GatewayRegistry: "0x5076a1F237531fa4dC8ad99bb68024aB6e1Ff701",
            BasicBridge: "0xcb6bD6B6c7D7415C0157e393Bb2B6Def7555d518",
        },
    },
};

export class BinanceSmartChain extends EthereumBaseChain {
    // Static members.
    public static chain = "BinanceSmartChain" as const;
    public static configMap = configMap;
    public static assets = {
        [RenNetwork.Mainnet]: { BNB: "BNB" as const },
        [RenNetwork.Testnet]: { BNB: "BNB" as const },
    };

    public assets:
        | typeof BinanceSmartChain.assets[RenNetwork.Mainnet]
        | typeof BinanceSmartChain.assets[RenNetwork.Testnet];
    public configMap = configMap;

    public constructor({
        network,
        ...params
    }: ConstructorParameters<typeof EthereumBaseChain>[0]) {
        super({
            ...params,
            network: resolveEVMNetworkConfig(configMap, network),
        });
        this.assets =
            BinanceSmartChain.assets[
                this.network.isTestnet ? RenNetwork.Testnet : RenNetwork.Mainnet
            ];
    }
}
