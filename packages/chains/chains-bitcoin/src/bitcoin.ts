import { RenNetwork } from "@renproject/utils";

import { Blockchain, BlockchainNetwork } from "./APIs/blockchain";
import { Blockchair } from "./APIs/blockchair";
import { Blockstream } from "./APIs/blockstream";
import { SoChain } from "./APIs/sochain";
import { BitcoinBaseChain } from "./base";
import {
    BitcoinNetworkConfig,
    BitcoinNetworkConfigMap,
    BitcoinNetworkInput,
} from "./utils/types";
import {
    resolveBitcoinNetworkConfig,
    StandardBitcoinExplorer,
} from "./utils/utils";

const BitcoinMainnet: BitcoinNetworkConfig = {
    label: "Bitcoin",

    selector: "Bitcoin",

    nativeAsset: {
        name: "Bitcoin",
        symbol: "BTC",
        decimals: 8,
    },
    averageConfirmationTime: 60 * 10,

    explorer: StandardBitcoinExplorer("https://live.blockcypher.com/btc/"),
    p2shPrefix: Buffer.from([0x05]),
    providers: [
        new Blockstream(),
        new Blockchair(),
        { api: new SoChain(), priority: 15 },
        { api: new Blockchain(BlockchainNetwork.Bitcoin), priority: 20 },
    ],
    // validateAddress: (address: string) =>
    //     validateAddress(address, "BTC", "mainnet"),
};

const BitcoinTestnet: BitcoinNetworkConfig = {
    label: "Bitcoin Testnet",

    selector: "Bitcoin",

    nativeAsset: {
        name: "Testnet Bitcoin",
        symbol: "BTC",
        decimals: 8,
    },
    averageConfirmationTime: 60 * 10,

    isTestnet: true,
    explorer: StandardBitcoinExplorer(
        "https://live.blockcypher.com/btc-testnet/",
    ),
    p2shPrefix: Buffer.from([0xc4]),
    providers: [
        new Blockstream({ testnet: true }),
        { api: new Blockchain(BlockchainNetwork.BitcoinTestnet), priority: 20 },
        // new Blockchair(BlockchairNetwork.BITCOIN_TESTNET),
        // { api: new SoChain(SoChainNetwork.BTCTEST), priority: 15 },
    ],
    // validateAddress: (address: string) =>
    //     validateAddress(address, "BTC", "testnet"),
};

/**
 * The Bitcoin class adds support for the asset BTC.
 */
export class Bitcoin extends BitcoinBaseChain {
    public static chain = "Bitcoin";
    public static configMap: BitcoinNetworkConfigMap = {
        [RenNetwork.Mainnet]: BitcoinMainnet,
        [RenNetwork.Testnet]: BitcoinTestnet,
        [RenNetwork.Devnet]: BitcoinTestnet,
    };
    public configMap = Bitcoin.configMap;

    public static assets = {
        BTC: "BTC",
    };
    public assets = Bitcoin.assets;

    public constructor({ network }: { network: BitcoinNetworkInput }) {
        super({
            network: resolveBitcoinNetworkConfig(Bitcoin.configMap, network),
        });
    }
}
