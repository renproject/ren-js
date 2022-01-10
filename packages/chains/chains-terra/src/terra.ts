import { bech32 } from "bech32";
import BigNumber from "bignumber.js";
import elliptic from "elliptic";

import {
    assertType,
    ChainTransaction,
    DepositChain,
    ErrorWithCode,
    InputChainTransaction,
    OutputType,
    RenJSError,
    RenNetwork,
    RenNetworkString,
    utils,
} from "@renproject/utils";
import {
    AccAddress,
    Key,
    RawKey,
    SimplePublicKey,
} from "@terra-money/terra.js";

import { TerraDev } from "./api/terraDev";
import { isTerraNetworkConfig, TerraNetworkConfig } from "./api/types";

export const TerraMainnet: TerraNetworkConfig = {
    selector: "Terra",
    chainId: "columbus-5",

    nativeAsset: {
        name: "Luna",
        symbol: "LUNA",
        decimals: 18,
    },

    explorer: "https://finder.terra.money/columbus",
    apiUrl: "https://fcd.terra.dev",
};

export const TerraTestnet: TerraNetworkConfig = {
    selector: "Terra",
    chainId: "bombay-12",

    nativeAsset: {
        name: "Luna",
        symbol: "LUNA",
        decimals: 18,
    },

    explorer: "https://finder.terra.money/bombay",
    apiUrl: "https://bombay-fcd.terra.dev",
};

export const TerraConfigMap = {
    [RenNetwork.Mainnet]: TerraMainnet,
    [RenNetwork.Testnet]: TerraTestnet,
    [RenNetwork.Devnet]: TerraTestnet,
};

export interface TerraReleasePayload {
    chain: string;
    address: string;
}

/**
 * Terra implements the LockChain interface for Terra (https://terra.money)
 * and it's asset LUNA.
 */
export class Terra
    implements DepositChain<{ chain: string }, TerraReleasePayload>
{
    public static chain = "Terra";
    public chain = Terra.chain;
    public name = Terra.chain;

    public static configMap = TerraConfigMap;
    public configMap = TerraConfigMap;

    public network: TerraNetworkConfig;

    public api: TerraDev;

    // The assets native to Terra.
    public nativeAsset = {
        name: "Luna",
        symbol: "LUNA",
        decimals: 6,
    };
    public static assets = {
        LUNA: "LUNA",
    };
    public assets = Terra.assets;

    public validateAddress(address: string): boolean {
        assertType<string>("string", { address: address });
        return AccAddress.validate(address);
    }

    public validateTransaction(transaction: ChainTransaction): boolean {
        return (
            utils.isHex(
                typeof transaction === "string"
                    ? transaction
                    : transaction.txidFormatted,
                { length: 32 },
            ) && utils.fromBase64(transaction.txid).length === 32
        );
    }

    public addressExplorerLink(address: string): string {
        return new URL(`/account/${address}`, /* base */ this.network.explorer)
            .href;
    }

    public transactionExplorerLink(transaction: ChainTransaction): string {
        return new URL(
            `/tx/${String(transaction.txidFormatted)}`,
            /* base */ this.network.explorer,
        ).href;
    }

    public formattedTransactionHash(tx: {
        txid: string;
        txindex: string;
    }): string {
        return utils.fromBase64(tx.txid).toString("hex").toUpperCase();
    }

    public constructor({
        network,
    }: {
        network: RenNetwork | RenNetworkString | TerraNetworkConfig;
    }) {
        const networkConfig = isTerraNetworkConfig(network)
            ? network
            : TerraConfigMap[network];
        if (!networkConfig) {
            if (typeof network === "string") {
                throw new Error(`Invalid RenVM network ${network}.`);
            } else {
                throw new Error(`Invalid Terra network config.`);
            }
        }

        this.network = networkConfig;
        this.chain = this.network.selector;
        this.api = new TerraDev(this.network);
    }

    public isLockAsset(asset: string): boolean {
        return this.assets[asset] !== undefined;
    }

    /**
     * See [[LockChain.isLockAsset]].
     */
    public isDepositAsset(asset: string): boolean {
        return this.isLockAsset(asset);
    }

    private _assertAssetIsSupported(asset: string) {
        if (!this.isLockAsset(asset)) {
            throw new Error(`Unsupported asset ${asset}.`);
        }
    }

    /**
     * See [[LockChain.assetDecimals]].
     */
    public assetDecimals(asset: string): number {
        switch (asset) {
            case Terra.assets.LUNA:
                return 6;
        }
        throw new Error(`Unsupported asset ${String(asset)}.`);
    }

    public getBalance = async (
        asset: string,
        address: string,
        // eslint-disable-next-line @typescript-eslint/require-await
    ): Promise<BigNumber> => {
        this._assertAssetIsSupported(asset);
        if (!this.validateAddress(address)) {
            throw new Error(`Invalid address ${address}.`);
        }
        // TODO: Implement.
        return new BigNumber(0);
    };

    /**
     * See [[LockChain.getDeposits]].
     */
    public async watchForDeposits(
        asset: string,
        fromPayload: { chain: string },
        address: string,
        onInput: (input: InputChainTransaction) => void,
        _removeInput: (input: InputChainTransaction) => void,
        listenerCancelled: () => boolean,
    ): Promise<void> {
        this._assertAssetIsSupported(asset);
        if (fromPayload.chain !== this.chain) {
            throw new Error(
                `Invalid payload for chain ${fromPayload.chain} instead of ${this.chain}.`,
            );
        }

        while (true) {
            if (listenerCancelled()) {
                return;
            }
            const txs = await this.api.fetchDeposits(address);

            await Promise.all(
                txs.map(async (tx) =>
                    onInput({
                        chain: this.chain,
                        txid: utils.toURLBase64(Buffer.from(tx.hash, "hex")),
                        txidFormatted: tx.hash.toUpperCase(),
                        txindex: "0",

                        asset,
                        amount: tx.amount,
                    }),
                ),
            );
        }
    }

    /**
     * See [[LockChain.transactionConfidence]].
     */
    public async transactionConfidence(
        transaction: ChainTransaction,
    ): Promise<BigNumber> {
        if (!this.network) {
            throw new Error(`${this.name} object not initialized.`);
        }
        return await this.api.fetchConfirmations(transaction.txidFormatted);
    }

    /**
     * See [[LockChain.getGatewayAddress]].
     */
    public createGatewayAddress(
        asset: string,
        fromPayload: { chain: string },
        shardPublicKey: Buffer,
        gHash: Buffer,
    ): string {
        this._assertAssetIsSupported(asset);
        if (fromPayload.chain !== this.chain) {
            throw new Error(
                `Invalid payload for chain ${fromPayload.chain} instead of ${this.chain}.`,
            );
        }

        const ec = new elliptic.ec("secp256k1");

        // Decode compressed RenVM public key.
        const renVMPublicKey = ec.keyFromPublic(shardPublicKey);

        // Interpret gHash as a private key.
        const gHashKey = ec.keyFromPrivate(gHash);

        // If `NO_PARAMS_FLAG` is set, set renVM public key and gHash public key,
        // and recreate key pair from resulting curve point.
        const derivedPublicKey = ec.keyFromPublic(
            renVMPublicKey
                .getPublic()
                .add(gHashKey.getPublic()) as unknown as elliptic.ec.KeyPair,
        );

        // 33-byte compressed public key.
        const newCompressedPublicKey: Buffer = Buffer.from(
            derivedPublicKey.getPublic().encodeCompressed(),
        );

        // Create Terra key from compressed public key, to calculate address.
        const address: Key = new (Key as {
            new (publicKey: SimplePublicKey): Key;
        })(new SimplePublicKey(newCompressedPublicKey.toString("base64")));

        return address.accAddress;
    }

    public getOutputPayload(
        asset: string,
        _type: OutputType.Release,
        toPayload: TerraReleasePayload,
    ): {
        to: string;
        toBytes: Buffer;
        payload: Buffer;
    } {
        this._assertAssetIsSupported(asset);
        return {
            to: toPayload.address,
            toBytes: Buffer.from(
                bech32.fromWords(bech32.decode(toPayload.address).words),
            ),
            payload: Buffer.from([]),
        };
    }

    // Methods for initializing mints and burns ////////////////////////////////

    /**
     * When burning, you can call `Terra.Address("...")` to make the address
     * available to the burn params.
     *
     * @category Main
     */
    public Address(address: string): { chain: string; address: string } {
        // Type validation
        assertType<string>("string", { address });

        if (!this.validateAddress(address)) {
            throw ErrorWithCode.from(
                new Error(`Invalid ${this.chain} address: ${String(address)}`),
                RenJSError.PARAMETER_ERROR,
            );
        }

        return {
            chain: this.chain,
            address,
        };
    }

    /**
     * When burning, you can call `Terra.Address("...")` to make the address
     * available to the burn params.
     *
     * @category Main
     */
    public GatewayAddress(): { chain: string } {
        return {
            chain: this.chain,
        };
    }
}
