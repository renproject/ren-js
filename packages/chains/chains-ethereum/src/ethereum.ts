import { RenNetwork } from "@renproject/utils";

import { EthereumBaseChain } from "./base";
import { resolveEVMNetworkConfig } from "./utils/generic";
import {
    EthereumClassConfig,
    EthProvider,
    EthSigner,
    EVMNetworkConfig,
    EVMNetworkInput,
    populateEVMNetwork,
} from "./utils/types";

const ethereumMainnet: EVMNetworkConfig = populateEVMNetwork({
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
});

const ethereumTestnet: EVMNetworkConfig = populateEVMNetwork({
    selector: "Ethereum",
    isTestnet: true,

    nativeAsset: { name: "Kovan Ether", symbol: "ETH", decimals: 18 },
    averageConfirmationTime: 15,

    config: {
        chainId: "0x2a",
        chainName: "Kovan",
        nativeCurrency: { name: "Kovan Ether", symbol: "KOV", decimals: 18 },
        rpcUrls: [
            "https://kovan.poa.network",
            "http://kovan.poa.network:8545",
            "https://kovan.infura.io/v3/${INFURA_API_KEY}",
            "wss://kovan.infura.io/ws/v3/${INFURA_API_KEY}",
            "ws://kovan.poa.network:8546",
        ],
        blockExplorerUrls: ["https://kovan.etherscan.io"],
    },

    addresses: {
        GatewayRegistry: "0x5076a1F237531fa4dC8ad99bb68024aB6e1Ff701",
        BasicBridge: "0xcb6bD6B6c7D7415C0157e393Bb2B6Def7555d518",
    },
});

const ethereumDevnet: EVMNetworkConfig = populateEVMNetwork({
    ...ethereumTestnet,
    addresses: {
        GatewayRegistry: "0x5045E727D9D9AcDe1F6DCae52B078EC30dC95455",
        BasicBridge: "0xFABDB1F53Ef8B080332621cBc9F820a39e7A1B83",
    },
});

/**
 * The Ethereum RenJS implementation.
 */
export class Ethereum extends EthereumBaseChain {
    public static chain = "Ethereum" as const;

    public static configMap = {
        [RenNetwork.Mainnet]: ethereumMainnet,
        [RenNetwork.Testnet]: ethereumTestnet,
        [RenNetwork.Devnet]: ethereumDevnet,
    };
    public configMap = Ethereum.configMap;

    public static assets = {
        ETH: "ETH",
        DAI: "DAI",
        REN: "REN",
        USDC: "USDC",
        USDT: "USDT",
        EURT: "EURT",
        BUSD: "BUSD",
        MIM: "MIM",
        CRV: "CRV",
        LINK: "LINK",
        UNI: "UNI",
        SUSHI: "SUSHI",
        FTT: "FTT",
        ROOK: "ROOK",
        BADGER: "BADGER",
        KNC: "KNC",
    };
    public assets = Ethereum.assets;

    /**
     * Create a new Ethereum instance.
     *
     * @param params Ethereum constructor parameters
     * @param params.network A RenVM network string or an EVM config object.
     * @param params.provider A Web3 or Ethers.js provider.
     * @param params.signer A Web3 or Ethers.js signer.
     * @param params.config Pass optional configurations, e.g. a logger
     */
    public constructor({
        network,
        provider,
        signer,
        config,
    }: {
        network: EVMNetworkInput;
        provider: EthProvider;
        signer?: EthSigner;
        config?: EthereumClassConfig;
    }) {
        super({
            network: resolveEVMNetworkConfig(Ethereum.configMap, network),
            provider,
            signer,
            config,
        });
    }
}
