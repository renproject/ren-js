import { LockChain, Logger, RenNetwork } from "@renproject/interfaces";
import {
    assertType,
    fromHex,
    hash160,
    keccak256,
    Ox,
    rawEncode,
    toBase64,
} from "@renproject/utils";
import { Networks, Opcode, Script } from "bitcore-lib";
import base58 from "bs58";
import { UTXO as SendCryptoUTXO } from "send-crypto";
import { BTCHandler } from "send-crypto/build/main/handlers/BTC/BTCHandler";
import { validate } from "wallet-address-validator";

import { createAddress, pubKeyScript as calculatePubKeyScript } from "./script";

export type Address = string;
export type Transaction = SendCryptoUTXO;
export type Deposit = {
    transaction: Transaction;
    amount: string;
};
export type Asset = string;
export type BitcoinNetwork = "mainnet" | "testnet" | "regtest";

const resolveBitcoinNetwork = (renNetwork: RenNetwork): BitcoinNetwork => {
    switch (renNetwork) {
        case RenNetwork.Mainnet:
        case RenNetwork.Chaosnet:
            return "mainnet";
        case RenNetwork.Testnet:
        case RenNetwork.Devnet:
        case RenNetwork.Localnet:
            return "testnet";
    }
    throw new Error(`Unrecognized network ${renNetwork}`);
};

const transactionToDeposit = (transaction: Transaction) => ({
    transaction,
    amount: transaction.amount.toString(),
});

export class BitcoinBaseChain
    implements LockChain<Transaction, Deposit, Asset, Address> {
    public name = "Btc";
    public renNetwork: RenNetwork | undefined;
    public chainNetwork: BitcoinNetwork | undefined;

    public asset = "BTC";
    public utils = {
        getUTXO: BTCHandler.getUTXO,
        getUTXOs: BTCHandler.getUTXOs,
        getTransactions: BTCHandler.getTransactions as
            | typeof BTCHandler.getTransactions
            | null,
        p2shPrefix: {
            mainnet: Buffer.from([0x05]),
            testnet: Buffer.from([0xc4]),
        },
        createAddress: createAddress(Networks, Opcode, Script, base58.encode),
        calculatePubKeyScript: calculatePubKeyScript(Networks, Opcode, Script),
        addressIsValid: (address: Address, network: BitcoinNetwork) =>
            validate(address, this.asset.toLowerCase(), network),
    };

    constructor(network?: BitcoinNetwork) {
        this.chainNetwork = network;
    }

    /**
     * See [[OriginChain.initialize]].
     */
    public initialize = (renNetwork: RenNetwork) => {
        this.renNetwork = renNetwork;
        // Prioritize the network passed in to the constructor.
        this.chainNetwork =
            this.chainNetwork || resolveBitcoinNetwork(renNetwork);
        return this;
    };

    /**
     * See [[OriginChain.assetIsNative]].
     */
    assetIsNative = (asset: Asset): boolean => asset === this.asset;

    public readonly assetAssetSupported = (asset: Asset) => {
        if (!this.assetIsNative(asset)) {
            throw new Error(`Unsupported asset ${asset}`);
        }
    };

    /**
     * See [[OriginChain.assetDecimals]].
     */
    assetDecimals = (asset: Asset): number => {
        if (asset === this.asset) {
            return 8;
        }
        throw new Error(`Unsupported asset ${asset}`);
    };

    /**
     * See [[OriginChain.getDeposits]].
     */
    getDeposits = async (
        asset: Asset,
        address: Address,
        firstCheck = false
    ): Promise<Deposit[]> => {
        if (!this.chainNetwork) {
            throw new Error(`${name} object not initialized`);
        }
        if (this.chainNetwork === "regtest") {
            throw new Error(`Unable to fetch deposits on ${this.chainNetwork}`);
        }
        this.assetAssetSupported(asset);
        if (firstCheck && this.utils.getTransactions) {
            return (
                await this.utils.getTransactions(
                    this.chainNetwork === "testnet",
                    {
                        address,
                        confirmations: 0,
                    }
                )
            ).map(transactionToDeposit);
        }

        return (
            await this.utils.getUTXOs(this.chainNetwork === "testnet", {
                address,
                confirmations: 0,
            })
        ).map(transactionToDeposit);
        // .filter((utxo) => utxo.amount > 70000);
    };

    /**
     * See [[OriginChain.transactionConfidence]].
     */
    transactionConfidence = async (
        transaction: Transaction
    ): Promise<{ current: number; target: number }> => {
        if (!this.chainNetwork) {
            throw new Error(`${name} object not initialized`);
        }
        transaction = await this.utils.getUTXO(
            this.chainNetwork === "testnet",
            transaction.txHash,
            transaction.vOut
        );
        return {
            current: transaction.confirmations,
            target: this.chainNetwork === "mainnet" ? 6 : 0,
        };
    };

    /**
     * See [[OriginChain.getGatewayAddress]].
     */
    getGatewayAddress = (
        asset: Asset,
        publicKey: Buffer,
        gHash: Buffer
    ): Promise<Address> | Address => {
        if (!this.chainNetwork) {
            throw new Error(`${name} object not initialized`);
        }
        this.assetAssetSupported(asset);
        const isTestnet = this.chainNetwork === "testnet";
        return this.utils.createAddress(
            isTestnet,
            hash160(publicKey),
            gHash,
            this.utils.p2shPrefix[isTestnet ? "testnet" : "mainnet"]
        );
    };

    getPubKeyScript = (asset: Asset, publicKey: Buffer, gHash: Buffer) => {
        if (!this.chainNetwork) {
            throw new Error(`${name} object not initialized`);
        }
        this.assetAssetSupported(asset);
        const isTestnet = this.chainNetwork === "testnet";
        return this.utils.calculatePubKeyScript(
            isTestnet,
            hash160(publicKey),
            gHash
        );
    };

    /**
     * See [[OriginChain.encodeAddress]].
     */
    encodeAddress = (address: Address): Buffer => {
        return Buffer.from(address);
    };

    /**
     * See [[OriginChain.decodeAddress]].
     */
    decodeAddress = (encodedAddress: Buffer): Address => {
        return encodedAddress.toString();
    };

    /**
     * See [[OriginChain.addressIsValid]].
     */
    addressIsValid = (address: Address): boolean => {
        if (!this.chainNetwork) {
            throw new Error(`${name} object not initialized`);
        }
        assertType<string>("string", { address });
        return this.utils.addressIsValid(address, this.chainNetwork);
    };

    /**
     * See [[OriginChain.addressExplorerLink]].
     */
    addressExplorerLink = (address: Address): string => {
        // TODO
        return address;
    };

    /**
     * See [[OriginChain.transactionExplorerLink]].
     */
    transactionID = (transaction: Transaction) => transaction.txHash;

    transactionExplorerLink = (transaction: Transaction): string => {
        return transaction.txHash;
    };

    depositV1HashString = ({ transaction }: Deposit): string => {
        return `${toBase64(fromHex(transaction.txHash))}_${transaction.vOut}`;
    };

    transactionRPCFormat = (transaction: Transaction, v2?: boolean) => {
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
