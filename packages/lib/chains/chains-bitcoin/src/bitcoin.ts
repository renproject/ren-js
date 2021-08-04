import {
    LockChain,
    ChainStatic,
    RenNetwork,
    RenNetworkDetails,
    RenNetworkString,
} from "@renproject/interfaces";
import { Callable, isHex, utilsWithChainNetwork } from "@renproject/utils";
import { createAddressBuffer, calculatePubKeyScript } from "./script/index";

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
export class BitcoinClass
    extends BitcoinBaseChain
    implements
        LockChain<BtcTransaction, BtcDeposit, BtcAddress, BtcNetwork, boolean>
{
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
        resolveChainNetwork: BitcoinBaseChain.utils.resolveChainNetwork,
        p2shPrefix: {
            mainnet: Buffer.from([0x05]),
            testnet: Buffer.from([0xc4]),
        },
        addressBufferToString: base58.encode as (bytes: Buffer) => string,
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
                BitcoinBaseChain.asset,
                Bitcoin.utils.resolveChainNetwork(network),
            ),

        transactionIsValid: (
            transaction: BtcTransaction | string,
            _network:
                | RenNetwork
                | RenNetworkString
                | RenNetworkDetails
                | BtcNetwork = "mainnet",
        ) =>
            isHex(
                typeof transaction === "string"
                    ? transaction
                    : transaction.txHash,
                { length: 32 },
            ),

        addressExplorerLink: (
            address: BtcAddress | string,
            network:
                | RenNetwork
                | RenNetworkString
                | RenNetworkDetails
                | BtcNetwork = "mainnet",
        ): string | undefined => {
            switch (Bitcoin.utils.resolveChainNetwork(network)) {
                case "mainnet":
                    return BlockCypher.Address(
                        BlockCypherNetwork.BitcoinMainnet,
                        address,
                    );
                case "testnet":
                    return BlockCypher.Address(
                        BlockCypherNetwork.BitcoinTestnet,
                        address,
                    );
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

            switch (Bitcoin.utils.resolveChainNetwork(network)) {
                case "mainnet":
                    return BlockCypher.Transaction(
                        BlockCypherNetwork.BitcoinMainnet,
                        txHash,
                    );
                case "testnet":
                    return BlockCypher.Transaction(
                        BlockCypherNetwork.BitcoinTestnet,
                        txHash,
                    );
                case "regtest":
                    return undefined;
            }
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

const _: ChainStatic<BtcTransaction, BtcAddress, BtcNetwork> = Bitcoin;

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
