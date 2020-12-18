import {
    getRenNetworkDetails,
    LockChain,
    MintChainStatic,
    RenNetwork,
    RenNetworkDetails,
    RenNetworkString,
} from "@renproject/interfaces";
import {
    assertType,
    fromHex,
    hash160,
    toBase64,
    utilsWithChainNetwork,
} from "@renproject/utils";
import { Networks, Opcode, Script } from "bitcore-lib";
import base58 from "bs58";
import { UTXO as SendCryptoUTXO } from "send-crypto";
import { BTCHandler } from "send-crypto/build/main/handlers/BTC/BTCHandler";

import { createAddress, pubKeyScript as calculatePubKeyScript } from "./script";
import { validateAddress } from "./utils";

export type BtcAddress = string;
export type BtcTransaction = SendCryptoUTXO;
export type BtcDeposit = {
    transaction: BtcTransaction;
    amount: string;
};
export type BtcNetwork = "mainnet" | "testnet" | "regtest";

const transactionToDeposit = (transaction: BtcTransaction) => ({
    transaction,
    amount: transaction.amount.toString(),
});

export abstract class BitcoinBaseChain
    implements
        LockChain<BtcTransaction, BtcDeposit, BtcAddress, BtcNetwork, boolean> {
    public static chain = "Bitcoin";
    public chain = BitcoinBaseChain.chain;
    public name = BitcoinBaseChain.chain;

    public legacyName: LockChain["legacyName"] = "Btc";
    public renNetwork: RenNetworkDetails | undefined;
    public chainNetwork: BtcNetwork | undefined;

    // Asset
    public static asset = "BTC";
    public asset = "BTC";

    // Utils
    public static utils = {
        getUTXO: BTCHandler.getUTXO,
        getUTXOs: BTCHandler.getUTXOs,
        getTransactions: BTCHandler.getTransactions,
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
                return `https://live.blockcypher.com/btc/address/${address}/`;
            } else if (network === "testnet") {
                return `https://live.blockcypher.com/btc-testnet/address/${address}/`;
            }
            return undefined;
        },

        transactionExplorerLink: (
            tx: BtcTransaction | string,
            network: BtcNetwork = "mainnet",
        ): string | undefined => {
            const txHash = typeof tx === "string" ? tx : tx.txHash;

            if (network === "mainnet") {
                return `https://live.blockcypher.com/btc/tx/${txHash}/`;
            } else if (network === "testnet") {
                return `https://live.blockcypher.com/btc-testnet/tx/${txHash}/`;
            }
            return undefined;
        },
    };

    public utils = utilsWithChainNetwork(
        BitcoinBaseChain.utils,
        () => this.chainNetwork,
    );

    constructor(network?: BtcNetwork) {
        this.chainNetwork = network;
    }

    /**
     * See [[LockChain.initialize]].
     */
    public initialize = (
        renNetwork: RenNetwork | RenNetworkString | RenNetworkDetails,
    ) => {
        this.renNetwork = getRenNetworkDetails(renNetwork);
        // Prioritize the network passed in to the constructor.
        this.chainNetwork =
            this.chainNetwork ||
            (this.renNetwork.isTestnet ? "testnet" : "mainnet");
        return this;
    };

    /**
     * See [[LockChain.assetIsNative]].
     */
    assetIsNative = (asset: string): boolean => asset === this.asset;
    assetIsSupported = this.assetIsNative;

    public readonly assertAssetIsSupported = (asset: string) => {
        if (!this.assetIsNative(asset)) {
            throw new Error(`Unsupported asset ${asset}.`);
        }
    };

    /**
     * See [[LockChain.assetDecimals]].
     */
    assetDecimals = (asset: string): number => {
        if (asset === this.asset) {
            return 8;
        }
        throw new Error(`Unsupported asset ${asset}`);
    };

    /**
     * See [[LockChain.getDeposits]].
     */
    getDeposits = async (
        asset: string,
        address: BtcAddress,
        progress: boolean | undefined,
        onDeposit: (deposit: BtcDeposit) => Promise<void>,
    ): Promise<boolean> => {
        if (!this.chainNetwork) {
            throw new Error(`${this.name} object not initialized`);
        }
        if (this.chainNetwork === "regtest") {
            throw new Error(`Unable to fetch deposits on ${this.chainNetwork}`);
        }
        this.assertAssetIsSupported(asset);

        const txs =
            !progress && this.utils.getTransactions
                ? await this.utils.getTransactions(
                      this.chainNetwork === "testnet",
                      {
                          address,
                          confirmations: 0,
                      },
                  )
                : await this.utils.getUTXOs(this.chainNetwork === "testnet", {
                      address,
                      confirmations: 0,
                  });

        await Promise.all(
            txs.map(async (tx) => onDeposit(transactionToDeposit(tx))),
        );

        return true;
    };

    /**
     * See [[LockChain.transactionConfidence]].
     */
    transactionConfidence = async (
        transaction: BtcTransaction,
    ): Promise<{ current: number; target: number }> => {
        if (!this.chainNetwork) {
            throw new Error(`${this.name} object not initialized`);
        }
        transaction = await this.utils.getUTXO(
            this.chainNetwork === "testnet",
            transaction.txHash,
            transaction.vOut,
        );
        return {
            current: transaction.confirmations,
            target: this.chainNetwork === "mainnet" ? 6 : 2,
        };
    };

    /**
     * See [[LockChain.getGatewayAddress]].
     */
    getGatewayAddress = (
        asset: string,
        publicKey: Buffer,
        gHash: Buffer,
    ): Promise<BtcAddress> | BtcAddress => {
        if (!this.chainNetwork) {
            throw new Error(`${this.name} object not initialized`);
        }
        this.assertAssetIsSupported(asset);
        const isTestnet = this.chainNetwork === "testnet";
        return this.utils.createAddress(
            isTestnet,
            hash160(publicKey),
            gHash,
            this.utils.p2shPrefix[isTestnet ? "testnet" : "mainnet"],
        );
    };

    getPubKeyScript = (asset: string, publicKey: Buffer, gHash: Buffer) => {
        if (!this.chainNetwork) {
            throw new Error(`${this.name} object not initialized`);
        }
        this.assertAssetIsSupported(asset);
        const isTestnet = this.chainNetwork === "testnet";
        return this.utils.calculatePubKeyScript(
            isTestnet,
            hash160(publicKey),
            gHash,
        );
    };

    /**
     * See [[LockChain.addressStringToBytes]].
     */
    addressStringToBytes = (address: string): Buffer => {
        return base58.decode(address);
    };

    /**
     * See [[LockChain.transactionID]].
     */
    transactionID = (transaction: BtcTransaction) => transaction.txHash;

    transactionFromID = async (txid: string | Buffer, txindex: string) =>
        this.utils.getUTXO(
            this.chainNetwork === "testnet",
            typeof txid === "string" ? txid : txid.toString("hex"),
            parseInt(txindex, 10),
        );

    depositV1HashString = ({ transaction }: BtcDeposit): string => {
        return `${toBase64(fromHex(transaction.txHash))}_${transaction.vOut}`;
    };

    transactionRPCFormat = (transaction: BtcTransaction, v2?: boolean) => {
        const { txHash, vOut } = transaction;

        assertType<string>("string", { txHash });
        assertType<number>("number", { vOut });

        return {
            txid: v2
                ? fromHex(transaction.txHash).reverse()
                : fromHex(transaction.txHash),
            txindex: transaction.vOut.toFixed(),
        };
    };
}

const _: MintChainStatic<
    BtcTransaction,
    BtcAddress,
    BtcNetwork
> = BitcoinBaseChain;
