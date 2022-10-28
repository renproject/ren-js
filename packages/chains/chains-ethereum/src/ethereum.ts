import { RenNetwork } from "@renproject/utils";

import { EthereumBaseChain } from "./base";
import { resolveEVMNetworkConfig } from "./utils/generic";
import { EVMNetworkConfig } from "./utils/types";

const ethereumMainnetConfig: EVMNetworkConfig = {
    selector: "Ethereum",

    nativeAsset: { name: "Ether", symbol: "ETH", decimals: 18 },
    averageConfirmationTime: 15,

    config: {
        chainId: "0x1",
        chainName: "Ethereum Mainnet",
        nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
        rpcUrls: [
            "https://cloudflare-eth.com",
            "https://mainnet.infura.io/v3/${INFURA_API_KEY}",
            "wss://mainnet.infura.io/ws/v3/${INFURA_API_KEY}",
            "https://api.mycryptoapi.com/eth",
        ],
        blockExplorerUrls: ["https://etherscan.io"],
    },

    addresses: {
        GatewayRegistry: "0xf36666C230Fa12333579b9Bd6196CB634D6BC506",
        BasicBridge: "0x82DF02A52E2e76C0c233367f2fE6c9cfe51578c5",
    },
};

const goerliConfig: EVMNetworkConfig = {
    selector: "Goerli",
    isTestnet: true,

    nativeAsset: { name: "Görli Ether", symbol: "gETH", decimals: 18 },
    averageConfirmationTime: 15,

    config: {
        chainId: "0x5",
        chainName: "Görli",
        nativeCurrency: {
            name: "Görli Ether",
            symbol: "GOR",
            decimals: 18,
        },
        rpcUrls: [
            "https://web3-trial.cloudflare-eth.com/v1/goerli",
            "https://goerli.infura.io/v3/${INFURA_API_KEY}",
            "https://eth-goerli.alchemyapi.io/v2/${ALCHEMY_API_KEY}",
            "wss://goerli.infura.io/v3/${INFURA_API_KEY}",
            "wss://eth-goerli.alchemyapi.io/v2/${ALCHEMY_API_KEY}",
        ],
        blockExplorerUrls: ["https://goerli.etherscan.io"],
    },

    addresses: {
        GatewayRegistry: "0x5076a1F237531fa4dC8ad99bb68024aB6e1Ff701",
        BasicBridge: "0xcb6bD6B6c7D7415C0157e393Bb2B6Def7555d518",
    },
};

export const defaultConfigMap: EthereumBaseChain["configMap"] = {
    [RenNetwork.Mainnet]: ethereumMainnetConfig,
    [RenNetwork.Testnet]: goerliConfig,
};

export const goerliConfigMap: EthereumBaseChain["configMap"] = {
    [RenNetwork.Mainnet]: ethereumMainnetConfig,
    [RenNetwork.Testnet]: goerliConfig,
};

export enum EthereumTestnet {
    Goerli = "goerli",
    Görli = "goerli",
}

/**
 * The Ethereum RenJS implementation.
 */
export class Ethereum extends EthereumBaseChain {
    // Static members.
    public static chain = "Ethereum" as const;
    public static configMap = defaultConfigMap;
    public static assets = {
        [RenNetwork.Mainnet]: {
            ETH: "ETH" as const,
            DAI: "DAI" as const,
            REN: "REN" as const,
            USDC: "USDC" as const,
            USDT: "USDT" as const,
            EURT: "EURT" as const,
            BUSD: "BUSD" as const,
            MIM: "MIM" as const,
            CRV: "CRV" as const,
            LINK: "LINK" as const,
            UNI: "UNI" as const,
            SUSHI: "SUSHI" as const,
            FTT: "FTT" as const,
            ROOK: "ROOK" as const,
            BADGER: "BADGER" as const,
            KNC: "KNC" as const,
        },
        [RenNetwork.Testnet]: {
            ETH: "gETH" as const,
            DAI: "DAI_Goerli" as const,
            REN: "REN_Goerli" as const,
            USDC: "USDC_Goerli" as const,
            USDT: "USDT_Goerli" as const,

            // Goerli only
            gETH: "gETH" as const,
            REN_Goerli: "REN_Goerli" as const,
            DAI_Goerli: "DAI_Goerli" as const,
            USDC_Goerli: "USDC_Goerli" as const,
            USDT_Goerli: "USDT_Goerli" as const,
            ETH_Goerli: "gETH" as const,
        },
    };

    public configMap = Ethereum.configMap;
    public assets:
        | typeof Ethereum.assets[RenNetwork.Mainnet]
        | typeof Ethereum.assets[RenNetwork.Testnet];

    /**
     * Create a new Ethereum instance.
     *
     * @param params Ethereum constructor parameters
     * @param params.network A RenVM network string or an EVM config object.
     * @param params.defaultTestnet Optionally specify a default Ethereum testnet.
     * @param params.provider A Web3 or Ethers.js provider.
     * @param params.signer A Web3 or Ethers.js signer.
     * @param params.config Pass optional configurations, e.g. a logger
     */
    public constructor({
        network,
        defaultTestnet,
        ...params
    }: ConstructorParameters<typeof EthereumBaseChain>[0] & {
        defaultTestnet: EthereumTestnet | `${EthereumTestnet}`;
    }) {
        const configMap =
            defaultTestnet === EthereumTestnet.Görli
                ? goerliConfigMap
                : defaultConfigMap;
        super({
            ...params,
            network: resolveEVMNetworkConfig(configMap, network),
        });
        this.configMap = configMap;
        this.assets =
            Ethereum.assets[
                this.network.isTestnet ? RenNetwork.Testnet : RenNetwork.Mainnet
            ];
    }
}
