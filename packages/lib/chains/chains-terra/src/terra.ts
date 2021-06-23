import bech32 from "bech32";
import {
    getRenNetworkDetails,
    LockChain,
    ChainStatic,
    RenNetwork,
    RenNetworkDetails,
    RenNetworkString,
} from "@renproject/interfaces";
import {
    assertType,
    Callable,
    isHex,
    toURLBase64,
    utilsWithChainNetwork,
} from "@renproject/utils";
import { AccAddress, Key } from "@terra-money/terra.js";
import { blake2b } from "blakejs";
import elliptic from "elliptic";

import {
    TerraAddress,
    TerraDeposit,
    TerraNetwork,
    TerraTransaction,
    transactionToDeposit,
    UNSUPPORTED_TERRA_NETWORK,
} from "./api/deposit";
import { terraDev } from "./api/terraDev";

const resolveTerraNetwork = (
    network: RenNetwork | RenNetworkString | RenNetworkDetails | TerraNetwork,
) => {
    if (network === TerraNetwork.Columbus || network === TerraNetwork.Tequila) {
        return network;
    }

    const renNetwork = getRenNetworkDetails(network);
    // Prioritize the network passed in to the constructor.
    return renNetwork.isTestnet ? TerraNetwork.Tequila : TerraNetwork.Columbus;
};

export enum TerraAssets {
    LUNA = "LUNA",
}

/**
 * TerraClass implements the LockChain interface for Terra (https://terra.money)
 * and it's asset LUNA.
 */
export class TerraClass
    implements
        LockChain<TerraTransaction, TerraDeposit, TerraAddress, TerraNetwork> {
    public static chain = "Terra";
    public chain = TerraClass.chain;
    public name = TerraClass.chain;

    public renNetwork: RenNetworkDetails | undefined;
    public chainNetwork: TerraNetwork | undefined;

    // The assets native to Terra.
    public assets = [TerraAssets.LUNA];

    public static utils = {
        resolveChainNetwork: resolveTerraNetwork,
        addressIsValid: (
            addressIn: TerraAddress | string,
            _network:
                | RenNetwork
                | RenNetworkString
                | RenNetworkDetails
                | TerraNetwork = TerraNetwork.Columbus,
        ): boolean => {
            const address =
                typeof addressIn === "string" ? addressIn : addressIn.address;
            assertType<string>("string", { address: address });
            return AccAddress.validate(address);
        },

        transactionIsValid: (
            transaction: TerraTransaction | string,
            _network:
                | RenNetwork
                | RenNetworkString
                | RenNetworkDetails
                | TerraNetwork = TerraNetwork.Columbus,
        ): boolean => {
            return isHex(
                typeof transaction === "string"
                    ? transaction
                    : transaction.hash,
                { length: 32 },
            );
        },

        addressExplorerLink: (
            addressIn: TerraAddress | string,
            network:
                | RenNetwork
                | RenNetworkString
                | RenNetworkDetails
                | TerraNetwork = TerraNetwork.Columbus,
        ): string => {
            return `https://finder.terra.money/${Terra.utils.resolveChainNetwork(
                network,
            )}/account/${
                typeof addressIn === "string" ? addressIn : addressIn.address
            }`;
        },

        transactionExplorerLink: (
            transaction: TerraTransaction | string,
            network:
                | RenNetwork
                | RenNetworkString
                | RenNetworkDetails
                | TerraNetwork = TerraNetwork.Columbus,
        ): string => {
            return `https://finder.terra.money/${Terra.utils.resolveChainNetwork(
                network,
            )}/tx/${
                typeof transaction === "string" ? transaction : transaction.hash
            }`;
        },
    };

    public utils = utilsWithChainNetwork<
        typeof TerraClass["utils"],
        TerraTransaction,
        TerraAddress,
        TerraNetwork
    >(TerraClass.utils, () => this.chainNetwork);

    constructor(network?: TerraNetwork) {
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
                ? TerraNetwork.Tequila
                : TerraNetwork.Columbus;

        return this;
    };

    /**
     * See [[LockChain.assetIsNative]].
     */
    assetIsNative = (asset: string): boolean =>
        this.assets.indexOf(asset as TerraAssets) >= 0;
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
        switch (asset) {
            case TerraAssets.LUNA:
                return 6;
        }
        throw new Error(`Unsupported asset ${String(asset)}.`);
    };

    /**
     * See [[LockChain.getDeposits]].
     */
    getDeposits = async (
        asset: string,
        address: TerraAddress,
        _instanceID: void,
        onDeposit: (deposit: TerraDeposit) => Promise<void>,
    ): Promise<void> => {
        if (!this.chainNetwork) {
            throw new Error(`${this.name} object not initialized.`);
        }
        this.assertAssetIsSupported(asset);
        const txs = await terraDev.fetchDeposits(
            address.address,
            this.chainNetwork,
        );

        await Promise.all(
            txs.map(async (tx) => onDeposit(transactionToDeposit(tx))),
        );
    };

    /**
     * See [[LockChain.transactionConfidence]].
     */
    transactionConfidence = async (
        transaction: TerraTransaction,
    ): Promise<{ current: number; target: number }> => {
        if (!this.chainNetwork) {
            throw new Error(`${this.name} object not initialized.`);
        }
        transaction = await terraDev.fetchDeposit(
            transaction.hash,
            transaction.messageIndex,
            this.chainNetwork,
        );
        return {
            current: transaction.confirmations,
            target: this.chainNetwork === TerraNetwork.Columbus ? 0 : 0,
        };
    };

    /**
     * See [[LockChain.getGatewayAddress]].
     */
    getGatewayAddress = (
        asset: string,
        compressedPublicKey: Buffer,
        gHash: Buffer,
    ): Promise<TerraAddress> | TerraAddress => {
        if (!this.renNetwork) {
            throw new Error(`${this.name} object not initialized.`);
        }
        this.assertAssetIsSupported(asset);

        const ec = new elliptic.ec("secp256k1");

        // Decode compressed RenVM public key.
        const renVMPublicKey = ec.keyFromPublic(compressedPublicKey);

        // Interpret gHash as a private key.
        const gHashKey = ec.keyFromPrivate(gHash);

        // If `NO_PARAMS_FLAG` is set, set renVM public key and gHash public key,
        // and recreate key pair from resulting curve point.
        const derivedPublicKey = ec.keyFromPublic(
            (renVMPublicKey
                .getPublic()
                .add(gHashKey.getPublic()) as unknown) as elliptic.ec.KeyPair,
        );

        const newCompressedPublicKey: Buffer = Buffer.from(
            derivedPublicKey.getPublic().encodeCompressed(),
        );

        // @ts-expect-error `Cannot create an instance of an abstract class`
        const address: Key = new Key(newCompressedPublicKey);

        return {
            asset,
            address: address.accAddress,
            // memo: toURLBase64(gHash),
        };
    };

    /**
     * See [[LockChain.addressStringToBytes]].
     */
    addressStringToBytes = (address: string): Buffer =>
        Buffer.from(bech32.fromWords(bech32.decode(address).words));

    /**
     * See [[LockChain.transactionID]].
     */
    transactionID = (transaction: TerraTransaction) => transaction.hash;

    transactionIDFromRPCFormat = (txid: string | Buffer, _txindex: string) =>
        typeof txid === "string" ? txid : txid.toString("hex");

    transactionFromRPCFormat = async (
        txid: string | Buffer,
        txindex: string,
    ) => {
        if (!this.chainNetwork) {
            throw new Error(`${this.name} object not initialized.`);
        }

        return terraDev.fetchDeposit(
            typeof txid === "string" ? txid : txid.toString("hex"),
            parseInt(txindex, 10),
            this.chainNetwork,
        );
    };
    /**
     * @deprecated renamed to `transactionFromRPCFormat`
     */
    transactionFromID = (txid: string | Buffer, txindex: string) =>
        this.transactionFromRPCFormat(txid, txindex);

    depositV1HashString = (_deposit: TerraDeposit): string => {
        throw new Error(UNSUPPORTED_TERRA_NETWORK);
    };

    transactionRPCFormat = (transaction: TerraTransaction, v2?: boolean) => {
        if (!v2) {
            throw new Error(UNSUPPORTED_TERRA_NETWORK);
        }

        return {
            txid: Buffer.from(transaction.hash, "hex"),
            txindex: "0",
        };
    };

    transactionRPCTxidFromID = (transactionID: string): Buffer =>
        Buffer.from(transactionID, "hex");

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

export type Terra = TerraClass;
// @dev Removes any static fields, except `utils`.
export const Terra = Callable(TerraClass);

const _: ChainStatic<TerraTransaction, TerraAddress, TerraNetwork> = Terra;
