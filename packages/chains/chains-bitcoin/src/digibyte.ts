import { RenNetwork } from "@renproject/utils";

import { Blockbook } from "./APIs/blockbook";
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

export const DigiByteMainnet: BitcoinNetworkConfig = {
    label: "DigiByte",

    selector: "DigiByte",
    nativeAsset: {
        name: "DigiByte",
        symbol: "DGB",
        decimals: 8,
    },
    explorer: StandardBitcoinExplorer("https://digiexplorer.info/"),
    p2shPrefix: Buffer.from([0x3f]),
    providers: [
        new Blockbook(
            "https://multichain-web-proxy.herokuapp.com/digibyte-mainnet",
        ),
        new Blockbook("https://digiexplorer.info/api"),
        new Blockbook("https://insight.digibyte.host/api"), // TODO: test again, currently broken
    ],
    // validateAddress: (address: string) =>
    //     validateAddress(address, "DGB", "mainnet"),
};

export const DigiByteTestnet: BitcoinNetworkConfig = {
    label: "DigiByte Testnet",

    selector: "DigiByte",
    nativeAsset: {
        name: "Testnet DigiByte",
        symbol: "DGB",
        decimals: 8,
    },
    isTestnet: true,
    explorer: StandardBitcoinExplorer(
        "`https://testnetexplorer.digibyteservers.io/",
    ),
    p2shPrefix: Buffer.from([0x8c]),
    providers: [
        new Blockbook("https://testnetexplorer.digibyteservers.io/api"),
    ],
    // validateAddress: (address: string) =>
    //     validateAddress(address, "DGB", "testnet"),
};

export const DigiByteConfigMap: BitcoinNetworkConfigMap = {
    [RenNetwork.Mainnet]: DigiByteMainnet,
    [RenNetwork.Testnet]: DigiByteTestnet,
    [RenNetwork.Devnet]: DigiByteTestnet,
};

export class DigiByte extends BitcoinBaseChain {
    public static chain = "DigiByte";
    public static configMap = DigiByteConfigMap;
    public configMap = DigiByteConfigMap;

    public static assets = {
        DGB: "DGB",
    };
    public assets = DigiByte.assets;

    public constructor(network: BitcoinNetworkInput) {
        super(resolveBitcoinNetworkConfig(DigiByte.configMap, network));
    }
}
