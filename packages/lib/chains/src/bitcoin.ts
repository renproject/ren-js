import { LockChain, RenNetwork } from "@renproject/interfaces";
import { toBase64 } from "@renproject/utils";
import { Networks, Opcode, Script } from "bitcore-lib";
import { encode } from "bs58";
import { UTXO as SendCryptoUTXO } from "send-crypto";
import {
    getConfirmations,
    getUTXOs,
} from "send-crypto/build/main/handlers/BTC/BTCHandler";
import { validate } from "wallet-address-validator";

import { createAddress } from "./common";
import { Ox, strip0x } from "./hexUtils";

export const createBTCAddress = createAddress(Networks, Opcode, Script);

export const getBitcoinConfirmations = ({
    isTestnet,
}: {
    isTestnet: boolean;
}) => {
    return async (txHash: string) => {
        return getConfirmations(isTestnet, txHash);
    };
};

export const btcAddressToHex = (address: string) => Ox(Buffer.from(address));

const isBTCAddress = (address: string) =>
    validate(address, "btc", "testnet") || validate(address, "btc", "prod");

export interface Tactics {
    decoders: Array<(address: string) => Buffer>;
    encoders: Array<(buffer: Buffer) => string>;
}

const btcTactics: Tactics = {
    decoders: [
        (address: string) => Buffer.from(address),
        (address: string) => Buffer.from(address, "base64"),
        (address: string) => Buffer.from(strip0x(address), "hex"),
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

type Address = string;
type Transaction = SendCryptoUTXO;
type Asset = string;
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

export class Bitcoin implements LockChain<Transaction, Asset, Address> {
    public name = "Bitcoin";
    private network: BitcoinNetwork | undefined;
    private renNetwork: RenNetwork | undefined;

    constructor(network?: BitcoinNetwork) {
        if (!(this instanceof Bitcoin)) return new Bitcoin(network);

        this.network = network;
    }

    /**
     * See [[OriginChain.initialize]].
     */
    public initialize = (renNetwork: RenNetwork) => {
        this.renNetwork = renNetwork;
        // Prioritize the network passed in to the constructor.
        this.network = this.network || resolveBitcoinNetwork(renNetwork);
    };

    /**
     * See [[OriginChain.supportsAsset]].
     */
    supportsAsset = (asset: Asset): boolean => asset === BTC;

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
        if (this.network === "regtest") {
            throw new Error(`Unable to fetch deposits on ${this.network}`);
        }
        if (!this.supportsAsset(asset)) {
            throw new Error(`Unsupported asset ${asset}`);
        }
        return (
            await getUTXOs(this.network === "testnet", {
                address,
                confirmations: 0,
            })
        ).map((utxo) => utxo);
    };

    /**
     * See [[OriginChain.transactionConfidence]].
     */
    transactionConfidence = (
        _transaction: Transaction
    ):
        | Promise<{ current: number; target: number }>
        | { current: number; target: number } => {
        throw new Error("unimplemented");
        // getBitcoinConfirmations;
    };

    /**
     * See [[OriginChain.getGatewayAddress]].
     */
    getGatewayAddress = (
        _asset: Asset,
        _publicKey: Buffer,
        _gHash: Buffer
    ): Promise<Address> | Address => {
        throw new Error("unimplemented");
        // createBTCAddress;
    };

    /**
     * See [[OriginChain.encodeAddress]].
     */
    encodeAddress? = (_address: Address): Buffer => {
        throw new Error("unimplemented");
    };

    /**
     * See [[OriginChain.decodeAddress]].
     */
    decodeAddress = (_encodedAddress: Buffer): Address => {
        throw new Error("unimplemented");
    };

    /**
     * See [[OriginChain.addressExplorerLink]].
     */
    addressExplorerLink = (_address: Address): string => {
        throw new Error("unimplemented");
    };

    /**
     * See [[OriginChain.transactionExplorerLink]].
     */
    transactionExplorerLink = (_transaction: Transaction): string => {
        throw new Error("unimplemented");
    };

    transactionHashString = (transaction: Transaction): string => {
        return `${toBase64(transaction.txHash)}_${transaction.vOut}`;
    };

    transactionRPCFormat = (transaction: Transaction) => {
        return {
            txHash: toBase64(transaction.txHash),
            vOut: transaction.vOut.toFixed(),
        };
    };
}
