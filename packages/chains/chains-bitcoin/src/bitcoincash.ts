import {
    isMainnetAddress,
    isTestnetAddress,
    isValidAddress,
    toCashAddress,
} from "bchaddrjs";
import bs58 from "bs58";

import { RenNetwork } from "@renproject/utils";

import { BitcoinDotCom } from "./APIs/bitcoinDotCom";
import { Blockchair, BlockchairNetwork } from "./APIs/blockchair";
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

const BitcoinCashMainnet: BitcoinNetworkConfig = {
    label: "Bitcoin Cash",

    selector: "BitcoinCash",
    nativeAsset: {
        name: "Bitcoin Cash",
        symbol: "BCH",
        decimals: 8,
    },
    explorer: StandardBitcoinExplorer("https://explorer.bitcoin.com/bch/"),
    p2shPrefix: Buffer.from([0x05]),
    providers: [
        new BitcoinDotCom(),
        new Blockchair(BlockchairNetwork.BITCOIN_CASH),
    ],
};

const BitcoinCashTestnet: BitcoinNetworkConfig = {
    label: "Bitcoin Cash Testnet",

    selector: "BitcoinCash",
    nativeAsset: {
        name: "Testnet Bitcoin Cash",
        symbol: "BCH",
        decimals: 8,
    },
    isTestnet: true,
    explorer: StandardBitcoinExplorer("https://explorer.bitcoin.com/tbch/"),
    p2shPrefix: Buffer.from([0xc4]),
    providers: [new BitcoinDotCom({ testnet: true })],
};

export class BitcoinCash extends BitcoinBaseChain {
    public static chain = "BitcoinCash";
    public static configMap: BitcoinNetworkConfigMap = {
        [RenNetwork.Mainnet]: BitcoinCashMainnet,
        [RenNetwork.Testnet]: BitcoinCashTestnet,
        [RenNetwork.Devnet]: BitcoinCashTestnet,
    };
    public configMap = BitcoinCash.configMap;

    public static assets = {
        BCH: "BCH",
    };
    public assets = BitcoinCash.assets;

    public validateAddress(address: string): boolean {
        return isValidAddress(address) && this.network.isTestnet
            ? isTestnetAddress(address)
            : isMainnetAddress(address);
    }

    public encodeAddress(bytes: Buffer): string {
        return toCashAddress(bs58.encode(bytes));
    }

    public constructor({ network }: { network: BitcoinNetworkInput }) {
        super({
            network: resolveBitcoinNetworkConfig(
                BitcoinCash.configMap,
                network,
            ),
        });
    }
}
