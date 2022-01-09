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

const DigiByteMainnet: BitcoinNetworkConfig = {
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
        new Blockbook("https://digibyteblockexplorer.com/api/")
    ],
    // validateAddress: (address: string) =>
    //     validateAddress(address, "DGB", "mainnet"),
};

const DigiByteTestnet: BitcoinNetworkConfig = {
    label: "DigiByte Testnet",

    selector: "DigiByte",
    nativeAsset: {
        name: "Testnet DigiByte",
        symbol: "DGB",
        decimals: 8,
    },
    isTestnet: true,
    explorer: StandardBitcoinExplorer(
        "https://testnet.digiexplorer.info/",
    ),
    p2shPrefix: Buffer.from([0x8c]),
    providers: [
        new Blockbook("https://testnet.digiexplorer.info/api"),
    ],
    // validateAddress: (address: string) =>
    //     validateAddress(address, "DGB", "testnet"),
};

export class DigiByte extends BitcoinBaseChain {
    public static chain = "DigiByte";
    public static configMap: BitcoinNetworkConfigMap = {
        [RenNetwork.Mainnet]: DigiByteMainnet,
        [RenNetwork.Testnet]: DigiByteTestnet,
        [RenNetwork.Devnet]: DigiByteTestnet,
    };
    public configMap = DigiByte.configMap;

    public static assets = {
        DGB: "DGB",
    };
    public assets = DigiByte.assets;

    public constructor(network: BitcoinNetworkInput) {
        super(resolveBitcoinNetworkConfig(DigiByte.configMap, network));
    }
}
