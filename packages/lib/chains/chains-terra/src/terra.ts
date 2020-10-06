import { LockChain, Logger, RenNetwork } from "@renproject/interfaces";
import { PackPrimitive } from "@renproject/rpc/src/v2/pack/pack";
import {
    assertType,
    Callable,
    fromHex,
    keccak256,
    Ox,
    rawEncode,
    toBase64,
    toURLBase64,
} from "@renproject/utils";
import { Key } from "@terra-money/terra.js";

import {
    resolveTerraNetwork,
    TerraAddress,
    TerraAsset,
    TerraDeposit,
    TerraNetwork,
    TerraTransaction,
    transactionToDeposit,
    UNSUPPORTED_TERRA_NETWORK,
} from "./api/deposit";
import { terraDev } from "./api/terraDev";

/**
 * TerraClass implements the LockChain interface for Terra (https://terra.money)
 * and it's asset LUNA.
 */
export class TerraClass
    implements
        LockChain<TerraTransaction, TerraDeposit, TerraAsset, TerraAddress> {
    public name = "Terra";
    public renNetwork: RenNetwork | undefined;
    public chainNetwork: TerraNetwork | undefined;

    // The assets native to Terra.
    public _assets = [TerraAsset.LUNA];

    constructor(network?: TerraNetwork) {
        this.chainNetwork = network;
    }

    /**
     * See [[OriginChain.initialize]].
     */
    public initialize = (renNetwork: RenNetwork) => {
        this.renNetwork = renNetwork;
        // Prioritize the network passed in to the constructor.
        this.chainNetwork =
            this.chainNetwork || resolveTerraNetwork(renNetwork);
        return this;
    };

    /**
     * See [[OriginChain.assetIsNative]].
     */
    assetIsNative = (asset: TerraAsset): boolean =>
        this._assets.indexOf(asset) >= 0;

    public readonly assetAssetSupported = (asset: TerraAsset) => {
        if (!this.assetIsNative(asset)) {
            throw new Error(`Unsupported asset ${asset}`);
        }
    };

    /**
     * See [[OriginChain.assetDecimals]].
     */
    assetDecimals = (asset: TerraAsset): number => {
        switch (asset) {
            case TerraAsset.LUNA:
                return 6;
        }
        throw new Error(`Unsupported asset ${asset}`);
    };

    /**
     * See [[OriginChain.getDeposits]].
     */
    getDeposits = async (
        asset: TerraAsset,
        address: TerraAddress
    ): Promise<TerraDeposit[]> => {
        if (!this.chainNetwork) {
            throw new Error(`${name} object not initialized`);
        }
        this.assetAssetSupported(asset);
        return (
            await terraDev.fetchDeposits(
                address.address,
                this.chainNetwork,
                address.memo
            )
        ).map(transactionToDeposit);
        // .filter((utxo) => utxo.amount > 70000);
    };

    /**
     * See [[OriginChain.transactionConfidence]].
     */
    transactionConfidence = async (
        transaction: TerraTransaction
    ): Promise<{ current: number; target: number }> => {
        if (!this.chainNetwork) {
            throw new Error(`${name} object not initialized`);
        }
        transaction = await terraDev.fetchDeposit(
            transaction.hash,
            transaction.messageIndex,
            this.chainNetwork
        );
        return {
            current: transaction.confirmations,
            target: this.chainNetwork === TerraNetwork.Columbus ? 0 : 0,
        };
    };

    /**
     * See [[OriginChain.getGatewayAddress]].
     */
    getGatewayAddress = (
        asset: TerraAsset,
        compressedPublicKey: Buffer,
        gHash: Buffer
    ): Promise<TerraAddress> | TerraAddress => {
        if (!this.chainNetwork) {
            throw new Error(`${name} object not initialized`);
        }
        this.assetAssetSupported(asset);

        // tslint:disable-next-line: no-any
        const address: Key = new (Key as any)(compressedPublicKey);

        return {
            asset,
            address: address.accAddress,
            memo: gHash.toString("base64"),
        };
    };

    getPubKeyScript = (
        asset: TerraAsset,
        _publicKey: Buffer,
        _gHash: Buffer
    ) => {
        this.assetAssetSupported(asset);
        return Buffer.from([]);
    };

    /**
     * See [[OriginChain.encodeAddress]].
     */
    encodeAddress = (address: TerraAddress): Buffer => {
        return Buffer.from(address.address);
    };

    /**
     * See [[OriginChain.decodeAddress]].
     */
    decodeAddress = (encodedAddress: Buffer): TerraAddress => {
        return {
            address: encodedAddress.toString(),
        };
    };

    /**
     * See [[OriginChain.addressIsValid]].
     */
    addressIsValid = (address: TerraAddress): boolean => {
        if (!this.chainNetwork) {
            throw new Error(`${name} object not initialized`);
        }
        assertType("string", { address });
        // TODO
        return true;
    };

    /**
     * See [[OriginChain.addressExplorerLink]].
     */
    addressExplorerLink = (address: TerraAddress): string => {
        // TODO: Provide multiple options, and check network.
        return `https://finder.terra.money/${this.chainNetwork}/account/${address.address}`;
    };

    /**
     * See [[OriginChain.transactionExplorerLink]].
     */
    transactionID = (transaction: TerraTransaction) => transaction.hash;

    transactionExplorerLink = (transaction: TerraTransaction): string => {
        // TODO: Provide multiple options, and check network.
        return `https://finder.terra.money/${this.chainNetwork}/tx/${transaction.hash}`;
    };

    depositV1HashString = (_deposit: TerraDeposit): string => {
        throw new Error(UNSUPPORTED_TERRA_NETWORK);
    };

    depositRPCFormat = (
        { transaction }: TerraDeposit,
        _pubKeyScript: Buffer,
        v2?: boolean
    ) => {
        if (!v2) {
            throw new Error(UNSUPPORTED_TERRA_NETWORK);
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
                txid: toURLBase64(Buffer.from(transaction.hash, "hex")),
                nonce: "0",
            },
        };
    };

    generateNHash = (
        _nonce: Buffer,
        { transaction }: TerraDeposit,
        v2?: boolean,
        logger?: Logger
    ): Buffer => {
        if (!v2) {
            throw new Error(UNSUPPORTED_TERRA_NETWORK);
        }

        const encoded = rawEncode(
            ["uint256", "bytes", "uint32"],
            [0, fromHex(transaction.hash), 0]
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
export type Terra = TerraClass;
export const Terra = Callable(TerraClass);
