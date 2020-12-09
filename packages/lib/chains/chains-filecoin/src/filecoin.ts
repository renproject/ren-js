import {
    decode as decodeAddress,
    encode as encodeAddress,
    validateAddressString,
} from "@glif/filecoin-address";
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
    Callable,
    toBase64,
    toURLBase64,
    utilsWithChainNetwork,
} from "@renproject/utils";
import { blake2b } from "blakejs";
import CID from "cids";
import elliptic from "elliptic";

import { FilNetwork as FilNetworkImport, FilTransaction } from "./deposit";
import { fetchDeposits, fetchMessage } from "./api/indexer";

export type FilNetwork = FilNetworkImport;

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
    implements LockChain<FilTransaction, FilDeposit, FilAddress, FilNetwork> {
    public static chain = "Filecoin";
    public chain = FilecoinClass.chain;
    public name = FilecoinClass.chain;

    public renNetwork: RenNetworkDetails | undefined;
    public chainNetwork: FilNetwork | undefined;

    public asset = "FIL";

    public static utils = {
        addressIsValid: (
            address: FilAddress,
            _network: FilNetwork = "mainnet",
        ) => validateAddressString(address.address),

        addressExplorerLink: (
            address: FilAddress,
            _network: FilNetwork = "mainnet",
        ): string => {
            // TODO: Check network.
            return `https://filfox.info/en/address/${address.address}`;
        },

        transactionExplorerLink: (
            transaction: FilTransaction,
            _network: FilNetwork = "mainnet",
        ): string => {
            // TODO: Check network.
            return `https://filfox.info/en/message/${transaction.cid}`;
        },
    };

    public utils = utilsWithChainNetwork<
        typeof FilecoinClass["utils"],
        FilTransaction,
        FilAddress,
        FilNetwork
    >(FilecoinClass.utils, () => this.chainNetwork);

    constructor(network?: FilNetwork) {
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
            this.chainNetwork || this.renNetwork.isTestnet
                ? "testnet"
                : "mainnet";
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
            return 18;
        }
        throw new Error(`Unsupported asset ${asset}.`);
    };

    /**
     * See [[LockChain.getDeposits]].
     */
    getDeposits = async (
        asset: string,
        address: FilAddress,
        _instanceID: unknown,
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
     * See [[LockChain.transactionConfidence]].
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
     * See [[LockChain.getGatewayAddress]].
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
     * See [[LockChain.addressStringToBytes]].
     */
    addressStringToBytes = (address: string): Buffer => {
        return decodeAddress(address).str;
    };

    /**
     * See [[LockChain.addressIsValid]].
     */
    addressIsValid = (address: FilAddress): boolean => {
        if (!this.chainNetwork) {
            throw new Error(`${this.name} object not initialized.`);
        }
        assertType<string>("string", { address: address.address });
        return FilecoinClass.utils.addressIsValid(address, this.chainNetwork);
    };

    /**
     * See [[LockChain.transactionID]].
     */
    transactionID = (transaction: FilTransaction) => transaction.cid;

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

    /** @category Main */
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

export type Filecoin = FilecoinClass;
// @dev Removes any static fields, except `utils`.
export const Filecoin = Callable(FilecoinClass);

const _: MintChainStatic<FilTransaction, FilAddress, FilNetwork> = Filecoin;
