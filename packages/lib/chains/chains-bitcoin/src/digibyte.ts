import {
    ChainStatic,
    RenNetwork,
    RenNetworkDetails,
    RenNetworkString,
} from "@renproject/interfaces";
import { Callable, utilsWithChainNetwork } from "@renproject/utils";
import base58 from "bs58";

import { Insight } from "./APIs/insight";
import { BtcAddress, BtcNetwork, BtcTransaction } from "./base";
import { BitcoinClass } from "./bitcoin";
import { createAddress, pubKeyScript } from "./script";
import { validateAddress } from "./utils";

export class DigiByteClass extends BitcoinClass {
    public static chain = "DigiByte";
    public chain = DigiByteClass.chain;
    public name = DigiByteClass.chain;

    // APIs
    public withDefaultAPIs = (network: BtcNetwork): this => {
        switch (network) {
            case "mainnet":
                // prettier-ignore
                return this
                    .withAPI(Insight("https://multichain-web-proxy.herokuapp.com/digibyte-mainnet"))
                    .withAPI(Insight("https://digiexplorer.info/api"))
                    .withAPI(Insight("https://insight.digibyte.host/api"))
            case "testnet":
                // prettier-ignore
                return this
                    .withAPI(Insight("https://testnetexplorer.digibyteservers.io/api"));
            case "regtest":
                throw new Error(`Regtest is currently not supported.`);
        }
    };

    public static asset = "DGB";
    public asset = DigiByteClass.asset;

    public static utils = {
        resolveChainNetwork: BitcoinClass.utils.resolveChainNetwork,
        p2shPrefix: {
            // Source: https://github.com/digicontributer/digibyte-js/blob/27156cd1cb4430c4a4959f46e809629846694434/lib/networks.js
            mainnet: Buffer.from([0x3f]),
            testnet: Buffer.from([0x8c]),
        },
        createAddress: createAddress(base58.encode),
        calculatePubKeyScript: pubKeyScript(),
        addressIsValid: (
            address: BtcAddress | string,
            network:
                | RenNetwork
                | RenNetworkString
                | RenNetworkDetails
                | BtcNetwork = "mainnet",
        ) =>
            validateAddress(
                address,
                DigiByteClass.asset,
                DigiByte.utils.resolveChainNetwork(network),
            ),

        addressExplorerLink: (
            address: BtcAddress | string,
            network:
                | RenNetwork
                | RenNetworkString
                | RenNetworkDetails
                | BtcNetwork = "mainnet",
        ): string | undefined => {
            switch (DigiByte.utils.resolveChainNetwork(network)) {
                case "mainnet":
                    return `https://digiexplorer.info/address/${address}`;
                case "testnet":
                    return `https://testnetexplorer.digibyteservers.io/address/${address}`;
                case "regtest":
                    return undefined;
            }
        },

        transactionExplorerLink: (
            tx: BtcTransaction | string,
            network:
                | RenNetwork
                | RenNetworkString
                | RenNetworkDetails
                | BtcNetwork = "mainnet",
        ): string | undefined => {
            const txHash = typeof tx === "string" ? tx : tx.txHash;

            switch (DigiByte.utils.resolveChainNetwork(network)) {
                case "mainnet":
                    return `https://digiexplorer.info/tx/${txHash}`;
                case "testnet":
                    return `https://testnetexplorer.digibyteservers.io/tx/${txHash}`;
                case "regtest":
                    return undefined;
            }
        },
    };

    public utils = utilsWithChainNetwork(
        DigiByteClass.utils,
        () => this.chainNetwork,
    );
}

export type DigiByte = DigiByteClass;
export const DigiByte = Callable(DigiByteClass);

const _: ChainStatic<BtcTransaction, BtcAddress, BtcNetwork> = DigiByte;
