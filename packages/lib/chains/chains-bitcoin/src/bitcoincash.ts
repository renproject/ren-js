import {
    ChainStatic,
    RenNetwork,
    RenNetworkDetails,
    RenNetworkString,
} from "@renproject/interfaces";
import { Callable, utilsWithChainNetwork } from "@renproject/utils";
import {
    toCashAddress,
    isMainnetAddress,
    isTestnetAddress,
    isValidAddress,
} from "bchaddrjs";
import { Networks, Opcode, Script } from "bitcore-lib-cash";
import base58 from "bs58";
import { BitcoinDotCom } from "./APIs/bitcoinDotCom";
import { Blockchair, BlockchairNetwork } from "./APIs/blockchair";

import { BtcAddress, BtcNetwork, BtcTransaction } from "./base";
import { BitcoinClass } from "./bitcoin";
import { createAddress, pubKeyScript } from "./script";
import { decodeBitcoinCashAddress } from "./bchaddrjs";

export class BitcoinCashClass extends BitcoinClass {
    public static chain = "BitcoinCash";
    public chain = BitcoinCashClass.chain;
    public name = BitcoinCashClass.chain;
    public legacyName = "Bch";

    // APIs
    public withDefaultAPIs = (network: BtcNetwork): this => {
        switch (network) {
            case "mainnet":
                // prettier-ignore
                return this
                    .withAPI(BitcoinDotCom())
                    .withAPI(Blockchair(BlockchairNetwork.BITCOIN_CASH));
            case "testnet":
                // prettier-ignore
                return this
                    .withAPI(BitcoinDotCom({ testnet: true }));
            case "regtest":
                throw new Error(`Regtest is currently not supported.`);
        }
    };

    public static asset = "BCH";
    public asset = "BCH";
    public static utils = {
        resolveChainNetwork: BitcoinClass.utils.resolveChainNetwork,
        p2shPrefix: {
            mainnet: Buffer.from([0x05]),
            testnet: Buffer.from([0xc4]),
        },
        createAddress: createAddress(
            (bytes: Buffer) => toCashAddress(base58.encode(bytes)),
            Networks,
            Opcode,
            Script,
        ),
        calculatePubKeyScript: pubKeyScript(Networks, Opcode, Script),
        addressIsValid: (
            address: BtcAddress | string,
            network:
                | RenNetwork
                | RenNetworkString
                | RenNetworkDetails
                | BtcNetwork = "mainnet",
        ) => {
            const btcNetwork = BitcoinCash.utils.resolveChainNetwork(network);
            return (
                isValidAddress(address) &&
                (btcNetwork === "mainnet"
                    ? isMainnetAddress(address)
                    : btcNetwork === "testnet"
                    ? isTestnetAddress(address)
                    : true)
            );
        },

        addressExplorerLink: (
            address: BtcAddress | string,
            network:
                | RenNetwork
                | RenNetworkString
                | RenNetworkDetails
                | BtcNetwork = "mainnet",
        ): string | undefined => {
            switch (BitcoinCash.utils.resolveChainNetwork(network)) {
                case "mainnet":
                    return `https://explorer.bitcoin.com/bch/address/${address}`;
                case "testnet":
                    return `https://explorer.bitcoin.com/tbch/address/${address}`;
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

            switch (BitcoinCash.utils.resolveChainNetwork(network)) {
                case "mainnet":
                    return `https://explorer.bitcoin.com/bch/tx/${txHash}`;
                case "testnet":
                    return `https://explorer.bitcoin.com/tbch/tx/${txHash}`;
                case "regtest":
                    return undefined;
            }
        },
    };

    public utils = utilsWithChainNetwork(
        BitcoinCashClass.utils,
        () => this.chainNetwork,
    );

    /**
     * See [[LockChain.addressStringToBytes]].
     */
    addressStringToBytes = (address: string): Buffer =>
        decodeBitcoinCashAddress(address);
}

export type BitcoinCash = BitcoinCashClass;
export const BitcoinCash = Callable(BitcoinCashClass);

const _: ChainStatic<BtcTransaction, BtcAddress, BtcNetwork> = BitcoinCash;
