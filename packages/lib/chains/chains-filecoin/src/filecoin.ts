import {
    encode as encodeAddress,
    validateAddressString,
} from "@openworklabs/filecoin-address";
import base32Function from "@openworklabs/filecoin-address/dist/base32";
import { LockChain, Logger, RenNetwork } from "@renproject/interfaces";
import { PackPrimitive } from "@renproject/rpc/src/v2/pack/pack";
import {
    assertType,
    Callable,
    fromHex,
    Ox,
    rawEncode,
    toBase64,
    toURLBase64,
} from "@renproject/utils";
import { blake2b } from "blakejs";
import elliptic from "elliptic";
import { keccak256 } from "ethereumjs-util";

import { FilTransaction } from "./api/deposit";
import { fetchDeposits, fetchMessage } from "./api/filscan";

const base32 = base32Function("abcdefghijklmnopqrstuvwxyz234567");

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

export const NETWORK_NOT_SUPPORTED = `Filecoin is not supported by the current RenVM network.`;

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

export class FilecoinChain
    implements LockChain<FilTransaction, FilDeposit, FilAsset, FilAddress> {
    public name = "Fil";
    public renNetwork: RenNetwork | undefined;
    public chainNetwork: FilecoinNetwork | undefined;

    public _asset = "FIL";
    public _addressIsValid = (address: FilAddress, _network: FilecoinNetwork) =>
        validateAddressString(address.address);

    constructor(
        network?: FilecoinNetwork,
        thisClass: typeof FilecoinChain = FilecoinChain
    ) {
        if (!(this instanceof FilecoinChain)) {
            return new (thisClass || FilecoinChain)(network);
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
            this.chainNetwork || resolveFilecoinNetwork(renNetwork);
        return this;
    };

    /**
     * See [[OriginChain.supportsAsset]].
     */
    supportsAsset = (asset: FilAsset): boolean => asset === this._asset;

    public readonly assetAssetSupported = (asset: FilAsset) => {
        if (!this.supportsAsset(asset)) {
            throw new Error(`Unsupported asset ${asset}`);
        }
    };

    /**
     * See [[OriginChain.assetDecimals]].
     */
    assetDecimals = (asset: FilAsset): number => {
        if (asset === this._asset) {
            return 8;
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
            target: this.chainNetwork === "mainnet" ? 6 : 0,
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
            params: gHash.toString("base64"),
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
        assertType("string", { address });
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

    depositRPCFormat = (
        { transaction }: FilDeposit,
        _pubKeyScript: Buffer,
        v2?: boolean
    ) => {
        if (!v2) {
            throw new Error(NETWORK_NOT_SUPPORTED);
        }

        return {
            t: {
                struct: [
                    {
                        txid: PackPrimitive.Bytes,
                    },
                    {
                        amount: PackPrimitive.U256,
                    },
                    {
                        nonce: PackPrimitive.U256,
                    },
                ],
            },
            v: {
                amount: transaction.amount,
                txid: toURLBase64(
                    Buffer.from(base32.decode(transaction.cid.slice(1)))
                ),
                nonce: transaction.nonce.toString(),
            },
        };
    };

    generateNHash = (
        nonce: Buffer,
        { transaction }: FilDeposit,
        v2?: boolean,
        logger?: Logger
    ): Buffer => {
        if (!v2) {
            throw new Error(NETWORK_NOT_SUPPORTED);
        }

        const encoded = rawEncode(
            ["bytes32", "bytes", "uint32"],
            [nonce, fromHex(transaction.cid).reverse(), 0]
        );

        const digest = keccak256(encoded);

        if (logger) {
            logger.debug("nHash", toBase64(digest), Ox(encoded));
        }

        return digest;
    };

    getBurnPayload: (() => string) | undefined;

    Address = (address: string): this => {
        // Type validation
        assertType("string", { address });

        this.getBurnPayload = () => address;
        return this;
    };

    burnPayload? = () => {
        return this.getBurnPayload ? this.getBurnPayload() : undefined;
    };
}

// @dev Removes any static fields.
export const Filecoin = Callable(FilecoinChain);
