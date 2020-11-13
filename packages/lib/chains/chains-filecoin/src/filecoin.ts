import {
    decode as decodeAddress,
    encode as encodeAddress,
    validateAddressString,
} from "@glif/filecoin-address";
import {
    getRenNetworkDetails,
    LockChain,
    RenNetwork,
    RenNetworkDetails,
    RenNetworkString,
} from "@renproject/interfaces";
import { assertType, Callable, toBase64, toURLBase64 } from "@renproject/utils";
import { blake2b } from "blakejs";
import CID from "cids";
import elliptic from "elliptic";

import {
    FilecoinNetwork as FilecoinNetworkImport,
    FilTransaction,
} from "./api/deposit";
import { fetchDeposits, fetchMessage } from "./api/indexer";

export type FilecoinNetwork = FilecoinNetworkImport;

export type FilAddress = {
    address: string; // Filecoin address
    params?: string; // base64
};
export type FilDeposit = {
    transaction: FilTransaction;
    amount: string;
};

const NETWORK_NOT_SUPPORTED = `Filecoin is not supported by the current RenVM network.`;

const transactionToDeposit = (transaction: FilTransaction) => ({
    transaction,
    amount: transaction.amount.toString(),
});

export class FilecoinClass
    implements LockChain<FilTransaction, FilDeposit, FilAddress> {
    public name = "Filecoin";
    public renNetwork: RenNetworkDetails | undefined;
    public chainNetwork: FilecoinNetwork | undefined;

    public asset = "FIL";
    public _addressIsValid = (address: FilAddress, _network: FilecoinNetwork) =>
        validateAddressString(address.address);

    constructor(network?: FilecoinNetwork) {
        this.chainNetwork = network;
    }

    /**
     * See [[OriginChain.initialize]].
     */
    public initialize = (
        renNetwork: RenNetwork | RenNetworkString | RenNetworkDetails,
    ) => {
        this.renNetwork = getRenNetworkDetails(renNetwork);
        // Prioritize the network passed in to the constructor.
        this.chainNetwork =
            this.chainNetwork || this.renNetwork.isTestnet
                ? "testnet"
                : "mainnet";
        return this;
    };

    /**
     * See [[OriginChain.assetIsNative]].
     */
    assetIsNative = (asset: string): boolean => asset === this.asset;
    assetIsSupported = this.assetIsNative;

    public readonly assertAssetIsSupported = (asset: string) => {
        if (!this.assetIsNative(asset)) {
            throw new Error(`Unsupported asset ${asset}.`);
        }
    };

    /**
     * See [[OriginChain.assetDecimals]].
     */
    assetDecimals = (asset: string): number => {
        if (asset === this.asset) {
            return 18;
        }
        throw new Error(`Unsupported asset ${asset}.`);
    };

    /**
     * See [[OriginChain.getDeposits]].
     */
    getDeposits = async (
        asset: string,
        address: FilAddress,
        _instanceID: number,
        onDeposit: (deposit: FilDeposit) => Promise<void>,
    ): Promise<void> => {
        if (!this.chainNetwork) {
            throw new Error(`${this.name} object not initialized.`);
        }
        if (this.chainNetwork === "devnet") {
            throw new Error(
                `Unable to fetch deposits on ${this.chainNetwork}.`,
            );
        }
        this.assertAssetIsSupported(asset);
        const txs = await fetchDeposits(
            address.address,
            address.params,
            this.chainNetwork,
        );

        for (const tx of txs) {
            await onDeposit(transactionToDeposit(tx));
        }
    };

    /**
     * See [[OriginChain.transactionConfidence]].
     */
    transactionConfidence = async (
        transaction: FilTransaction,
    ): Promise<{ current: number; target: number }> => {
        if (!this.chainNetwork) {
            throw new Error(`${this.name} object not initialized.`);
        }
        transaction = await fetchMessage(transaction.cid, this.chainNetwork);
        return {
            current: transaction.confirmations,
            target: this.chainNetwork === "mainnet" ? 12 : 6, // NOT FINAL VALUES
        };
    };

    /**
     * See [[OriginChain.getGatewayAddress]].
     */
    getGatewayAddress = (
        asset: string,
        compressedPublicKey: Buffer,
        gHash: Buffer,
    ): Promise<FilAddress> | FilAddress => {
        if (!this.chainNetwork) {
            throw new Error(`${this.name} object not initialized.`);
        }
        this.assertAssetIsSupported(asset);

        const ec = new elliptic.ec("secp256k1");
        const publicKey = ec
            .keyFromPublic(compressedPublicKey)
            .getPublic(false, "hex");

        const payload = Buffer.from(
            blake2b(Buffer.from(publicKey, "hex"), null, 20),
        );

        // secp256k1 protocol prefix
        const protocol = 1;
        // network prefix
        const networkPrefix = this.chainNetwork === "testnet" ? "t" : "f";

        const addressObject = {
            str: Buffer.concat([Buffer.from([protocol]), payload]),
            protocol: () => protocol,
            payload: () => payload,
        };

        const address = encodeAddress(networkPrefix, addressObject);

        return {
            address,
            params: toBase64(Buffer.from(toURLBase64(gHash))),
        };
    };

    getPubKeyScript = (asset: string, _publicKey: Buffer, _gHash: Buffer) => {
        this.assertAssetIsSupported(asset);
        return Buffer.from([]);
    };

    /**
     * See [[OriginChain.addressStringToBytes]].
     */
    addressStringToBytes = (address: string): Buffer => {
        return decodeAddress(address).str;
    };

    /**
     * See [[OriginChain.addressIsValid]].
     */
    addressIsValid = (address: FilAddress): boolean => {
        if (!this.chainNetwork) {
            throw new Error(`${this.name} object not initialized.`);
        }
        assertType<string>("string", { address: address.address });
        return this._addressIsValid(address, this.chainNetwork);
    };

    /**
     * See [[OriginChain.addressExplorerLink]].
     */
    addressExplorerLink = (address: FilAddress): string => {
        // TODO: Check network.
        return `https://filfox.info/en/address/${address.address}`;
    };

    /**
     * See [[OriginChain.transactionExplorerLink]].
     */
    transactionID = (transaction: FilTransaction) => transaction.cid;

    transactionExplorerLink = (transaction: FilTransaction): string => {
        // TODO: Check network.
        return `https://filfox.info/en/message/${transaction.cid}`;
    };

    depositV1HashString = (_deposit: FilDeposit): string => {
        throw new Error(NETWORK_NOT_SUPPORTED);
    };

    transactionRPCFormat = (transaction: FilTransaction, v2?: boolean) => {
        if (!v2) {
            throw new Error(NETWORK_NOT_SUPPORTED);
        }

        return {
            txid: Buffer.from(new CID(transaction.cid).bytes),
            txindex: transaction.nonce.toFixed(),
        };
    };

    getBurnPayload: (() => string) | undefined;

    Address = (address: string): this => {
        // Type validation
        assertType<string>("string", { address });

        this.getBurnPayload = () => address;
        return this;
    };

    burnPayload? = () => {
        return this.getBurnPayload ? this.getBurnPayload() : undefined;
    };
}

// @dev Removes any static fields.
export type Filecoin = FilecoinClass;
export const Filecoin = Callable(FilecoinClass);
