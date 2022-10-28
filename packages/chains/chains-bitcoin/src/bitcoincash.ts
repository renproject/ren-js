import { RenNetwork } from "@renproject/utils";
import {
    isMainnetAddress,
    isTestnetAddress,
    isValidAddress,
    toCashAddress,
} from "bchaddrjs";
import bs58 from "bs58";

import { BitcoinDotCom } from "./APIs/bitcoinDotCom";
import { Blockchain, BlockchainNetwork } from "./APIs/blockchain";
import { Blockchair, BlockchairNetwork } from "./APIs/blockchair";
import { BitcoinBaseChain } from "./base";
import { decodeBitcoinCashAddress } from "./utils/bchaddrjs";
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
    averageConfirmationTime: 60 * 10,

    explorer: StandardBitcoinExplorer("https://explorer.bitcoin.com/bch/"),
    p2shPrefix: new Uint8Array([0x05]),
    providers: [
        new Blockchair(BlockchairNetwork.BITCOIN_CASH),
        { api: new BitcoinDotCom(), priority: 15 },
        { api: new Blockchain(BlockchainNetwork.BitcoinCash), priority: 20 },
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
    averageConfirmationTime: 60 * 10,

    isTestnet: true,
    explorer: StandardBitcoinExplorer("https://explorer.bitcoin.com/tbch/"),
    p2shPrefix: new Uint8Array([0xc4]),
    providers: [
        new Blockchain(BlockchainNetwork.BitcoinCashTestnet),
        { api: new BitcoinDotCom({ testnet: true }), priority: 15 },
    ],
};

export class BitcoinCash extends BitcoinBaseChain {
    public static chain = "BitcoinCash" as const;
    public static configMap: BitcoinNetworkConfigMap = {
        [RenNetwork.Mainnet]: BitcoinCashMainnet,
        [RenNetwork.Testnet]: BitcoinCashTestnet,
    };
    public configMap = BitcoinCash.configMap;

    public static assets = {
        [RenNetwork.Mainnet]: {
            BCH: "BCH",
        },
        [RenNetwork.Testnet]: {
            BCH: "BCH",
        },
    };

    public assets:
        | typeof BitcoinCash.assets[RenNetwork.Mainnet]
        | typeof BitcoinCash.assets[RenNetwork.Testnet];

    public validateAddress = (address: string): boolean => {
        try {
            return (
                isValidAddress(address) &&
                (this.network.isTestnet
                    ? isTestnetAddress(address)
                    : isMainnetAddress(address))
            );
        } catch (error) {
            return false;
        }
    };

    public addressFromBytes = (bytes: Uint8Array): string => {
        return toCashAddress(bs58.encode(bytes));
    };

    public addressToBytes = (address: string): Uint8Array => {
        return decodeBitcoinCashAddress(address);
    };

    public constructor({ network }: { network: BitcoinNetworkInput }) {
        super({
            network: resolveBitcoinNetworkConfig(
                BitcoinCash.configMap,
                network,
            ),
        });
        this.assets =
            BitcoinCash.assets[
                this.network.isTestnet ? RenNetwork.Testnet : RenNetwork.Mainnet
            ];
    }
}
