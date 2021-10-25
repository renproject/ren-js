import { RenNetwork } from "@renproject/utils";

import { EthereumBaseChain } from "./base";
import {
    EthereumClassConfig,
    EthProvider,
    EvmNetworkConfig,
    EvmNetworkConfigMap,
    EvmNetworkInput,
} from "./utils/types";
import { resolveEvmNetworkConfig } from "./utils/utils";

export const ethereumMainnet: EvmNetworkConfig = {
    selector: "Ethereum",

    network: {
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
        GatewayRegistry: "0xe80d347DF1209a76DD9d2319d62912ba98C54DDD",
        BasicAdapter: "0x32666B64e9fD0F44916E1378Efb2CFa3B3B96e80",
    },
};

export const ethereumTestnet: EvmNetworkConfig = {
    selector: "Ethereum",
    isTestnet: true,

    network: {
        chainId: "0x2a",
        chainName: "Ethereum Testnet Kovan",
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
        GatewayRegistry: "0x707bBd01A54958d1c0303b29CAfA9D9fB2D61C10",
        BasicAdapter: "0x52aF1b09DC11B47DcC935877a7473E35D946b7C9",
    },
};

export const ethereumDevnet: EvmNetworkConfig = {
    ...ethereumTestnet,
    addresses: {
        GatewayRegistry: "0x5045E727D9D9AcDe1F6DCae52B078EC30dC95455",
        BasicAdapter: "0xFABDB1F53Ef8B080332621cBc9F820a39e7A1B83",
    },
};

export class Ethereum extends EthereumBaseChain {
    public static chain = "Ethereum";

    public static configMap: EvmNetworkConfigMap = {
        [RenNetwork.Mainnet]: ethereumMainnet,
        [RenNetwork.Testnet]: ethereumTestnet,
        [RenNetwork.Devnet]: ethereumDevnet,
    };
    public configMap: EvmNetworkConfigMap = Ethereum.configMap;

    constructor(
        network: EvmNetworkInput,
        web3Provider: EthProvider,
        config: EthereumClassConfig = {},
    ) {
        super(
            resolveEvmNetworkConfig(Ethereum.configMap, network),
            web3Provider,
            config,
        );
    }
}
