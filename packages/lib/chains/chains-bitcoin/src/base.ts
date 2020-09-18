import { LockChain, Logger, RenNetwork } from "@renproject/interfaces";
import {
    assertType,
    fromHex,
    hash160,
    Ox,
    rawEncode,
    toBase64,
    toURLBase64,
} from "@renproject/utils";
import { Networks, Opcode, Script } from "bitcore-lib";
import base58 from "bs58";
import { keccak256 } from "ethereumjs-util";
import { UTXO as SendCryptoUTXO } from "send-crypto";
import {
    getUTXO,
    getUTXOs,
} from "send-crypto/build/main/handlers/BTC/BTCHandler";
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

    public _asset = "BTC";
    public _getUTXO = getUTXO;
    public _getUTXOs = getUTXOs;
    public _p2shPrefix: { mainnet: Buffer; testnet: Buffer } = {
        mainnet: Buffer.from([0x05]),
        testnet: Buffer.from([0xc4]),
    };
    public _createAddress = createAddress(
        Networks,
        Opcode,
        Script,
        base58.encode
    );
    public _calculatePubKeyScript = calculatePubKeyScript(
        Networks,
        Opcode,
        Script
    );
    public _addressIsValid = (address: string, network: BitcoinNetwork) =>
        validate(address, this._asset.toLowerCase(), network);

    constructor(
        network?: BitcoinNetwork,
        thisClass: typeof BitcoinBaseChain = BitcoinBaseChain
    ) {
        if (!(this instanceof BitcoinBaseChain)) {
            return new (thisClass || BitcoinBaseChain)(network);
        }

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
     * See [[OriginChain.supportsAsset]].
     */
    supportsAsset = (asset: Asset): boolean => asset === this._asset;

    public readonly assetAssetSupported = (asset: Asset) => {
        if (!this.supportsAsset(asset)) {
            throw new Error(`Unsupported asset ${asset}`);
        }
    };

    /**
     * See [[OriginChain.assetDecimals]].
     */
    assetDecimals = (asset: Asset): number => {
        if (asset === this._asset) {
            return 8;
        }
        throw new Error(`Unsupported asset ${asset}`);
    };

    /**
     * See [[OriginChain.getDeposits]].
     */
    getDeposits = async (
        asset: Asset,
        address: Address
    ): Promise<Deposit[]> => {
        if (!this.chainNetwork) {
            throw new Error(`${name} object not initialized`);
        }
        if (this.chainNetwork === "regtest") {
            throw new Error(`Unable to fetch deposits on ${this.chainNetwork}`);
        }
        this.assetAssetSupported(asset);
        return (
            await this._getUTXOs(this.chainNetwork === "testnet", {
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
        transaction = await this._getUTXO(
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
        return this._createAddress(
            isTestnet,
            hash160(publicKey),
            gHash,
            this._p2shPrefix[isTestnet ? "testnet" : "mainnet"]
        );
    };

    getPubKeyScript = (asset: Asset, publicKey: Buffer, gHash: Buffer) => {
        if (!this.chainNetwork) {
            throw new Error(`${name} object not initialized`);
        }
        this.assetAssetSupported(asset);
        const isTestnet = this.chainNetwork === "testnet";
        return this._calculatePubKeyScript(
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
        assertType("string", { address });
        return this._addressIsValid(address, this.chainNetwork);
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

    depositRPCFormat = (
        { transaction }: Deposit,
        pubKeyScript: Buffer,
        v2?: boolean
    ) => {
        if (v2) {
            return {
                outpoint: {
                    hash: toURLBase64(fromHex(transaction.txHash).reverse()),
                    index: transaction.vOut.toFixed(),
                },
                pubKeyScript: toURLBase64(pubKeyScript),
                value: transaction.amount.toString(),
            };
        }

        return {
            txHash: toBase64(fromHex(transaction.txHash)),
            vOut: transaction.vOut.toFixed(),
        };
    };

    generateNHash = (
        nonce: Buffer,
        { transaction }: Deposit,
        v2?: boolean,
        logger?: Logger
    ): Buffer => {
        const encoded = rawEncode(
            ["bytes32", v2 ? "bytes" : "bytes32", "uint32"],
            [nonce, fromHex(transaction.txHash).reverse(), transaction.vOut]
        );

        const digest = keccak256(encoded);

        if (logger) {
            logger.debug("nHash", toBase64(digest), Ox(encoded));
        }

        return digest;
    };
}
