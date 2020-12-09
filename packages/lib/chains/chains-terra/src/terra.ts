import {
    getRenNetworkDetails,
    LockChain,
    MintChainStatic,
    RenNetwork,
    RenNetworkDetails,
    RenNetworkString,
} from "@renproject/interfaces";
import { assertType, Callable, utilsWithChainNetwork } from "@renproject/utils";
import { Key } from "@terra-money/terra.js";

import {
    TerraAddress,
    TerraDeposit,
    TerraNetwork,
    TerraTransaction,
    transactionToDeposit,
    UNSUPPORTED_TERRA_NETWORK,
} from "./api/deposit";
import { terraDev } from "./api/terraDev";

const resolveNetwork = (network: TerraNetwork | "mainnet" | "testnet") =>
    network === "mainnet"
        ? TerraNetwork.Columbus
        : network === "testnet"
        ? TerraNetwork.Tequila
        : network;

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
    public assets = ["Luna"];

    public static utils = {
        addressIsValid: (
            address: TerraAddress,
            _network:
                | TerraNetwork
                | "mainnet"
                | "testnet" = TerraNetwork.Columbus,
        ): boolean => {
            assertType<string>("string", { address: address.address });
            // TODO
            return true;
        },

        addressExplorerLink: (
            address: TerraAddress,
            network:
                | TerraNetwork
                | "mainnet"
                | "testnet" = TerraNetwork.Columbus,
        ): string => {
            return `https://finder.terra.money/${resolveNetwork(
                network,
            )}/account/${address.address}`;
        },

        transactionExplorerLink: (
            transaction: TerraTransaction,
            network:
                | TerraNetwork
                | "mainnet"
                | "testnet" = TerraNetwork.Columbus,
        ): string => {
            return `https://finder.terra.money/${resolveNetwork(network)}/tx/${
                transaction.hash
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
    assetIsNative = (asset: string): boolean => this.assets.indexOf(asset) >= 0;
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
            case "Luna":
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
            address.memo,
        );

        for (const tx of txs) {
            await onDeposit(transactionToDeposit(tx));
        }
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
        if (!this.chainNetwork) {
            throw new Error(`${this.name} object not initialized.`);
        }
        this.assertAssetIsSupported(asset);

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const address: Key = new (Key as any)(compressedPublicKey);

        return {
            asset,
            address: address.accAddress,
            memo: gHash.toString("base64"),
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
        // TODO
        return Buffer.from(address);
    };

    /**
     * See [[LockChain.transactionID]].
     */
    transactionID = (transaction: TerraTransaction) => transaction.hash;

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

const _: MintChainStatic<TerraTransaction, TerraAddress, TerraNetwork> = Terra;
