import { RenNetwork } from "@renproject/utils";
import BTCValidator from "wallet-address-validator/src/bitcoin_validator";

import { Blockchair, BlockchairNetwork } from "./APIs/blockchair";
import { SoChain, SoChainNetwork } from "./APIs/sochain";
import { BitcoinBaseChain } from "./base";
import {
    BitcoinNetworkConfig,
    BitcoinNetworkConfigMap,
    BitcoinNetworkInput,
} from "./utils/types";
import { resolveBitcoinNetworkConfig, SoChainExplorer } from "./utils/utils";

const DogecoinMainnet: BitcoinNetworkConfig = {
    label: "Dogecoin",

    selector: "Dogecoin",
    nativeAsset: {
        name: "Dogecoin",
        symbol: "DOGE",
        decimals: 8,
    },
    averageConfirmationTime: 60,
    explorer: SoChainExplorer("doge", "DOGE"),
    p2shPrefix: new Uint8Array([0x16]),
    providers: [
        new Blockchair(BlockchairNetwork.DOGECOIN),
        { api: new SoChain(SoChainNetwork.DOGE), priority: 15 },
    ],
    // validateAddress: (address: string) =>
    //     validateAddress(address, "DOGE", "mainnet"),
};

const DogecoinTestnet: BitcoinNetworkConfig = {
    label: "Dogecoin Testnet",

    selector: "Dogecoin",
    nativeAsset: {
        name: "Testnet Dogecoin",
        symbol: "DOGE",
        decimals: 8,
    },
    averageConfirmationTime: 60,
    isTestnet: true,
    explorer: SoChainExplorer("testnet/doge", "DOGETEST"),
    p2shPrefix: new Uint8Array([0xc4]),
    providers: [{ api: new SoChain(SoChainNetwork.DOGETEST), priority: 15 }],
    // validateAddress: (address: string) =>
    //     validateAddress(address, "DOGE", "testnet"),
};

export class Dogecoin extends BitcoinBaseChain {
    public static chain = "Dogecoin" as const;
    public static configMap: BitcoinNetworkConfigMap = {
        [RenNetwork.Mainnet]: DogecoinMainnet,
        [RenNetwork.Testnet]: DogecoinTestnet,
    };
    public configMap = Dogecoin.configMap;

    public static assets = {
        [RenNetwork.Mainnet]: {
            DOGE: "DOGE",
        },
        [RenNetwork.Testnet]: {
            DOGE: "DOGE",
        },
    };

    public assets:
        | typeof Dogecoin.assets[RenNetwork.Mainnet]
        | typeof Dogecoin.assets[RenNetwork.Testnet];

    public validateAddress = (address: string): boolean => {
        try {
            const currency = {
                name: "dogecoin",
                symbol: "doge",
                addressTypes: { prod: ["1e", "16"], testnet: ["71", "c4"] },
                segwitHrp: "invalid",
                validator: BTCValidator,
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
            network: resolveBitcoinNetworkConfig(Dogecoin.configMap, network),
        });
        this.assets =
            Dogecoin.assets[
                this.network.isTestnet ? RenNetwork.Testnet : RenNetwork.Mainnet
            ];
    }
}
