import { LockChain, Logger, RenNetwork } from "@renproject/interfaces";
import {
    fromBase64,
    fromHex,
    hash160,
    rawEncode,
    toBase64,
    toURLBase64,
} from "@renproject/utils";
import { Networks, Opcode, Script } from "bitcore-lib";
import { encode } from "bs58";
import { keccak256 } from "ethereumjs-util";
import { UTXO as SendCryptoUTXO } from "send-crypto";
import {
    getConfirmations,
    getUTXO,
    getUTXOs,
} from "send-crypto/build/main/handlers/BTC/BTCHandler";
import { validate } from "wallet-address-validator";

import { Callable } from "../class";
import {
    createAddress,
    pubKeyScript as calculatePubKeyScript,
} from "../common";
import { Ox } from "../hexUtils";

// export const getBitcoinConfirmations = ({
//     isTestnet,
// }: {
//     isTestnet: boolean;
// }) => {
//     return async (txHash: string) => {
//         return getConfirmations(isTestnet, txHash);
//     };
// };

// export const btcAddressToHex = (address: string) => Ox(Buffer.from(address));

const isBTCAddress = (address: string) =>
    validate(address, "btc", "testnet") || validate(address, "btc", "prod");

export interface Tactics {
    decoders: Array<(address: string) => Buffer>;
    encoders: Array<(buffer: Buffer) => string>;
}

const btcTactics: Tactics = {
    decoders: [
        (address: string) => Buffer.from(address),
        (address: string) => fromBase64(address),
        (address: string) => fromHex(address),
    ],
    encoders: [
        (buffer: Buffer) => encode(buffer), // base58
        (buffer: Buffer) => buffer.toString(),
    ],
};

export const anyAddressFrom = (
    isAnyAddress: (address: string) => boolean,
    { encoders, decoders }: Tactics
) => (address: string) => {
    for (const encoder of encoders) {
        for (const decoder of decoders) {
            try {
                const encoded = encoder(decoder(address));
                if (isAnyAddress(encoded)) {
                    return encoded;
                }
            } catch (error) {
                // Ignore errors
            }
        }
    }
    return address;
};

export const btcAddressFrom = anyAddressFrom(isBTCAddress, btcTactics);

export type Address = string;
export type Transaction = SendCryptoUTXO;
export type Asset = string;
export type BitcoinNetwork = "mainnet" | "testnet" | "regtest";

const BTC = "BTC";

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

export class BitcoinBaseChain
    implements LockChain<Transaction, Asset, Address> {
    public name = "Btc";
    public renNetwork: RenNetwork | undefined;
    public chainNetwork: BitcoinNetwork | undefined;

    constructor(network?: BitcoinNetwork, thisClass?: typeof BitcoinBaseChain) {
        if (!(this instanceof BitcoinBaseChain))
            return new (thisClass || BitcoinBaseChain)(network);

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
    supportsAsset = (asset: Asset): boolean => asset === BTC;

    public readonly assetAssetSupported = (asset: Asset) => {
        if (!this.supportsAsset(asset)) {
            throw new Error(`Unsupported asset ${asset}`);
        }
    };

    /**
     * See [[OriginChain.assetDecimals]].
     */
    assetDecimals = (asset: Asset): number => {
        if (asset === BTC) {
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
    ): Promise<Transaction[]> => {
        if (this.chainNetwork === "regtest") {
            throw new Error(`Unable to fetch deposits on ${this.chainNetwork}`);
        }
        this.assetAssetSupported(asset);
        return (
            await getUTXOs(this.chainNetwork === "testnet", {
                address,
                confirmations: 0,
            })
        ).map((utxo) => utxo);
    };

    /**
     * See [[OriginChain.transactionConfidence]].
     */
    transactionConfidence = async (
        transaction: Transaction
    ): Promise<{ current: number; target: number }> => {
        transaction = await getUTXO(
            this.chainNetwork === "testnet",
            transaction.txHash,
            transaction.vOut
        );
        return {
            current: transaction.confirmations,
            target: this.chainNetwork === "mainnet" ? 6 : 2,
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
        this.assetAssetSupported(asset);
        return createAddress(Networks, Opcode, Script)(
            this.chainNetwork === "testnet",
            hash160(publicKey).toString("hex"),
            gHash.toString("hex")
        );
    };

    getPubKeyScript = (asset: Asset, publicKey: Buffer, gHash: Buffer) => {
        this.assetAssetSupported(asset);
        return calculatePubKeyScript(Networks, Opcode, Script)(
            this.chainNetwork === "testnet",
            hash160(publicKey).toString("hex"),
            gHash.toString("hex")
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

    transactionHashString = (transaction: Transaction): string => {
        return `${toBase64(transaction.txHash)}_${transaction.vOut}`;
    };

    transactionRPCFormat = (
        transaction: Transaction,
        pubKeyScript: Buffer,
        v2?: boolean
    ) => {
        if (v2) {
            return {
                outpoint: {
                    hash: toURLBase64(
                        Buffer.from(transaction.txHash, "hex").reverse()
                    ),
                    index: transaction.vOut.toFixed(),
                },
                pubKeyScript: toURLBase64(pubKeyScript),
                value: transaction.amount.toString(),
            };
        }

        return {
            txHash: toBase64(transaction.txHash),
            vOut: transaction.vOut.toFixed(),
        };
    };

    generateNHash = (
        nonce: Buffer,
        deposit: Transaction,
        v2?: boolean,
        logger?: Logger
    ): Buffer => {
        const encoded = rawEncode(
            ["bytes32", v2 ? "bytes" : "bytes32", "uint32"],
            [
                Ox(nonce),
                Ox(Buffer.from(deposit.txHash, "hex").reverse()),
                deposit.vOut,
            ]
        );

        const digest = keccak256(encoded);

        if (logger)
            logger.debug(
                "nHash",
                digest.toString("hex"),
                encoded.toString("hex")
            );

        return digest;
    };
}
