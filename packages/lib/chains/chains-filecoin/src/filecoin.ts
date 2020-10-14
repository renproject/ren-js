import {
    encode as encodeAddress,
    validateAddressString,
} from "@glif/filecoin-address";
import { LockChain, Logger, RenNetwork } from "@renproject/interfaces";
import {
    assertType,
    Callable,
    keccak256,
    Ox,
    rawEncode,
    toBase64,
    toURLBase64,
} from "@renproject/utils";
import { blake2b } from "blakejs";
import CID from "cids";
import elliptic from "elliptic";

import { FilTransaction } from "./api/deposit";
import { fetchDeposits, fetchMessage } from "./api/indexer";

export type FilAddress = {
    address: string; // Filecoin address
    params?: string; // base64
};
export type FilDeposit = {
    transaction: FilTransaction;
    amount: string;
};
export type FilAsset = string;
export type FilecoinNetwork = "mainnet" | "testnet" | "devnet";

const NETWORK_NOT_SUPPORTED = `Filecoin is not supported by the current RenVM network.`;

const resolveFilecoinNetwork = (renNetwork: RenNetwork): FilecoinNetwork => {
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

const transactionToDeposit = (transaction: FilTransaction) => ({
    transaction,
    amount: transaction.amount,
});

export class FilecoinClass
    implements LockChain<FilTransaction, FilDeposit, FilAsset, FilAddress> {
    public name = "Filecoin";
    public renNetwork: RenNetwork | undefined;
    public chainNetwork: FilecoinNetwork | undefined;

    public _asset = "FIL";
    public _addressIsValid = (address: FilAddress, _network: FilecoinNetwork) =>
        validateAddressString(address.address);

    constructor(network?: FilecoinNetwork) {
        this.chainNetwork = network;
    }

    /**
     * See [[OriginChain.initialize]].
     */
    public initialize = (renNetwork: RenNetwork) => {
        this.renNetwork = renNetwork;
        // Prioritize the network passed in to the constructor.
        this.chainNetwork =
            this.chainNetwork || resolveFilecoinNetwork(renNetwork);
        return this;
    };

    /**
     * See [[OriginChain.assetIsNative]].
     */
    assetIsNative = (asset: FilAsset): boolean => asset === this._asset;

    public readonly assetAssetSupported = (asset: FilAsset) => {
        if (!this.assetIsNative(asset)) {
            throw new Error(`Unsupported asset ${asset}`);
        }
    };

    /**
     * See [[OriginChain.assetDecimals]].
     */
    assetDecimals = (asset: FilAsset): number => {
        if (asset === this._asset) {
            return 18;
        }
        throw new Error(`Unsupported asset ${asset}`);
    };

    /**
     * See [[OriginChain.getDeposits]].
     */
    getDeposits = async (
        asset: FilAsset,
        address: FilAddress
    ): Promise<FilDeposit[]> => {
        if (!this.chainNetwork) {
            throw new Error(`${name} object not initialized`);
        }
        if (this.chainNetwork === "devnet") {
            throw new Error(`Unable to fetch deposits on ${this.chainNetwork}`);
        }
        this.assetAssetSupported(asset);
        return (await fetchDeposits(address.address, address.params)).map(
            transactionToDeposit
        );
        // .filter((utxo) => utxo.amount > 70000);
    };

    /**
     * See [[OriginChain.transactionConfidence]].
     */
    transactionConfidence = async (
        transaction: FilTransaction
    ): Promise<{ current: number; target: number }> => {
        if (!this.chainNetwork) {
            throw new Error(`${name} object not initialized`);
        }
        transaction = await fetchMessage(transaction.cid);
        return {
            current: transaction.confirmations,
            target: this.chainNetwork === "mainnet" ? 6 : 1,
        };
    };

    /**
     * See [[OriginChain.getGatewayAddress]].
     */
    getGatewayAddress = (
        asset: FilAsset,
        compressedPublicKey: Buffer,
        gHash: Buffer
    ): Promise<FilAddress> | FilAddress => {
        if (!this.chainNetwork) {
            throw new Error(`${name} object not initialized`);
        }
        this.assetAssetSupported(asset);
        const isTestnet = this.chainNetwork === "testnet";

        const ec = new elliptic.ec("secp256k1");
        const publicKey = ec
            .keyFromPublic(compressedPublicKey)
            .getPublic(false, "hex");

        const payload = Buffer.from(
            blake2b(Buffer.from(publicKey, "hex"), null, 20)
        );

        // secp256k1 protocol prefix
        const protocol = 1;
        // network prefix
        const networkPrefix = isTestnet ? "t" : "f";

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

    getPubKeyScript = (asset: FilAsset, _publicKey: Buffer, _gHash: Buffer) => {
        this.assetAssetSupported(asset);
        return Buffer.from([]);
    };

    /**
     * See [[OriginChain.encodeAddress]].
     */
    encodeAddress = (address: FilAddress): Buffer => {
        return Buffer.from(address.address);
    };

    /**
     * See [[OriginChain.decodeAddress]].
     */
    decodeAddress = (encodedAddress: Buffer): FilAddress => {
        return {
            address: encodedAddress.toString(),
        };
    };

    /**
     * See [[OriginChain.addressIsValid]].
     */
    addressIsValid = (address: FilAddress): boolean => {
        if (!this.chainNetwork) {
            throw new Error(`${name} object not initialized`);
        }
        assertType<string>("string", { address: address.address });
        return this._addressIsValid(address, this.chainNetwork);
    };

    /**
     * See [[OriginChain.addressExplorerLink]].
     */
    addressExplorerLink = (address: FilAddress): string => {
        // TODO: Provide multiple options, and check network.
        return `https://filfox.info/en/address/${address.address}`;
    };

    /**
     * See [[OriginChain.transactionExplorerLink]].
     */
    transactionID = (transaction: FilTransaction) => transaction.cid;

    transactionExplorerLink = (transaction: FilTransaction): string => {
        // TODO: Provide multiple options, and check network.
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
