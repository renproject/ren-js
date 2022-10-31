import { RenNetwork } from "@renproject/utils";
import BTCValidator from "wallet-address-validator/src/bitcoin_validator";

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
    averageConfirmationTime: 15,
    explorer: StandardBitcoinExplorer("https://digiexplorer.info/"),
    p2shPrefix: new Uint8Array([0x3f]),
    providers: [
        new Blockbook("https://digiexplorer.info/api"),
        new Blockbook("https://insight.digibyte.host/api"), // TODO: test again, currently broken
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
    averageConfirmationTime: 15,
    isTestnet: true,
    explorer: StandardBitcoinExplorer(
        "`https://testnetexplorer.digibyteservers.io/",
    ),
    p2shPrefix: new Uint8Array([0x8c]),
    providers: [
        new Blockbook("https://testnetexplorer.digibyteservers.io/api"),
    ],
    // validateAddress: (address: string) =>
    //     validateAddress(address, "DGB", "testnet"),
};

export class DigiByte extends BitcoinBaseChain {
    public static chain = "DigiByte" as const;
    public static configMap: BitcoinNetworkConfigMap = {
        [RenNetwork.Mainnet]: DigiByteMainnet,
        [RenNetwork.Testnet]: DigiByteTestnet,
    };
    public configMap = DigiByte.configMap;

    public static assets = {
        [RenNetwork.Mainnet]: {
            DGB: "DGB",
        },
        [RenNetwork.Testnet]: {
            DGB: "DGB",
        },
    };

    public assets:
        | typeof DigiByte.assets[RenNetwork.Mainnet]
        | typeof DigiByte.assets[RenNetwork.Testnet];

    public validateAddress = (address: string): boolean => {
        try {
            const currency = {
                name: "digibyte",
                symbol: "dgb",
                addressTypes: { prod: ["1e", "3f"], testnet: ["7e", "8c"] },
                validator: BTCValidator,
                segwitHrp: this.network.isTestnet ? "dgbt" : "dgb",
            };

            return currency.validator.isValidAddress(
                address,
                currency,
                this.network.isTestnet ? "testnet" : "prod",
            );
        } catch (error) {
            return false;
        }
    };

    public constructor({ network }: { network: BitcoinNetworkInput }) {
        super({
            network: resolveBitcoinNetworkConfig(DigiByte.configMap, network),
        });
        this.assets =
            DigiByte.assets[
                this.network.isTestnet ? RenNetwork.Testnet : RenNetwork.Mainnet
            ];
    }
}
