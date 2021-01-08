import { LockChain, MintChainStatic } from "@renproject/interfaces";
import { Callable, utilsWithChainNetwork } from "@renproject/utils";
import { createAddress, pubKeyScript as calculatePubKeyScript } from "./script";
import { Networks, Opcode, Script } from "bitcore-lib";

import {
    BtcAddress,
    BitcoinBaseChain,
    BtcNetwork,
    BtcDeposit,
    BtcTransaction,
} from "./base";
import { validateAddress } from "./utils";
import { Blockstream } from "./APIs/blockstream";
import { Blockchair, BlockchairNetwork } from "./APIs/blockchair";
import { SoChain, SoChainNetwork } from "./APIs/sochain";
import base58 from "bs58";

/**
 * The Bitcoin class adds support for the asset BTC.
 */
export class BitcoinClass extends BitcoinBaseChain
    implements
        LockChain<BtcTransaction, BtcDeposit, BtcAddress, BtcNetwork, boolean> {
    public static chain = "Bitcoin";
    public chain = BitcoinClass.chain;
    public name = BitcoinClass.chain;
    public legacyName: LockChain["legacyName"] = "Btc";

    // Asset
    public static asset = "BTC";
    public asset = "BTC";

    // APIs
    public withDefaultAPIs = (network: BtcNetwork): this => {
        switch (network) {
            case "mainnet":
                // prettier-ignore
                return this
                    .withAPI(Blockstream())
                    .withAPI(Blockchair())
                    .withAPI(SoChain(), { priority: 15 });
            case "testnet":
                // prettier-ignore
                return this
                    .withAPI(Blockstream({ testnet: true }))
                    .withAPI(Blockchair(BlockchairNetwork.BITCOIN_TESTNET))
                    .withAPI(SoChain(SoChainNetwork.BTCTEST), { priority: 15 });
            case "regtest":
                // Will be supported when Electrum is added as an API.
                throw new Error(`Regtest is currently not supported.`);
        }
    };

    public static utils = {
        p2shPrefix: {
            mainnet: Buffer.from([0x05]),
            testnet: Buffer.from([0xc4]),
        },
        createAddress: createAddress(Networks, Opcode, Script, base58.encode),
        calculatePubKeyScript: calculatePubKeyScript(Networks, Opcode, Script),
        addressIsValid: (
            address: BtcAddress | string,
            network: BtcNetwork = "mainnet",
        ) => validateAddress(address, BitcoinBaseChain.asset, network),

        addressExplorerLink: (
            address: BtcAddress | string,
            network: BtcNetwork = "mainnet",
        ): string | undefined => {
            if (network === "mainnet") {
                return BlockCypher.Address(
                    BlockCypherNetwork.BitcoinMainnet,
                    address,
                );
            } else if (network === "testnet") {
                return BlockCypher.Address(
                    BlockCypherNetwork.BitcoinTestnet,
                    address,
                );
            }
            return undefined;
        },

        transactionExplorerLink: (
            tx: BtcTransaction | string,
            network: BtcNetwork = "mainnet",
        ): string | undefined => {
            const txHash = typeof tx === "string" ? tx : tx.txHash;

            if (network === "mainnet") {
                return BlockCypher.Transaction(
                    BlockCypherNetwork.BitcoinMainnet,
                    txHash,
                );
            } else if (network === "testnet") {
                return BlockCypher.Transaction(
                    BlockCypherNetwork.BitcoinTestnet,
                    txHash,
                );
            }
            return undefined;
        },
    };

    public utils = utilsWithChainNetwork(
        BitcoinClass.utils,
        () => this.chainNetwork,
    );
}

// @dev Removes any static fields.
export type Bitcoin = BitcoinClass;
export const Bitcoin = Callable(BitcoinClass);

const _: MintChainStatic<BtcTransaction, BtcAddress, BtcNetwork> = Bitcoin;

// Explorers ///////////////////////////////////////////////////////////////////

export enum BlockCypherNetwork {
    BitcoinMainnet = "btc",
    BitcoinTestnet = "btc-testnet",
}

export const BlockCypher = {
    Address: (network: BlockCypherNetwork, address: string) =>
        `https://live.blockcypher.com/${network}/address/${address}/`,

    Transaction: (network: BlockCypherNetwork, txHash: string) =>
        `https://live.blockcypher.com/${network}/tx/${txHash}/`,
};
