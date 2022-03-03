import BigNumber from "bignumber.js";
import base58 from "bs58";

import {
    assertType,
    ChainTransaction,
    DepositChain,
    ErrorWithCode,
    InputChainTransaction,
    InputType,
    OutputType,
    RenJSError,
    utils,
} from "@renproject/utils";

import { APIWithPriority, BitcoinAPI, CombinedAPI } from "./APIs/API";
import { createAddressBuffer } from "./script/index";
import {
    BitcoinNetworkConfig,
    BitcoinNetworkConfigMap,
    BitcoinNetworkInput,
    BitcoinReleasePayload,
    isBitcoinNetworkConfig,
} from "./utils/types";
import { addressToBytes, hash160, validateAddress } from "./utils/utils";

/**
 * A base Bitcoin chain class that is extended by each Bitcoin chain/fork.
 */
export abstract class BitcoinBaseChain
    implements
        DepositChain<
            {
                chain: string;
            },
            BitcoinReleasePayload
        >
{
    public static chain: string;
    public chain: string;
    public assets: { [asset: string]: string } = {};

    public static configMap: BitcoinNetworkConfigMap = {};
    public configMap: BitcoinNetworkConfigMap = {};

    public network: BitcoinNetworkConfig;

    public api = new CombinedAPI();

    public constructor({ network }: { network: BitcoinNetworkInput }) {
        const networkConfig = isBitcoinNetworkConfig(network)
            ? network
            : this.configMap[network];
        if (!networkConfig) {
            if (typeof network === "string") {
                throw new Error(`Unknown network ${network}.`);
            } else {
                throw new Error(`Invalid network config.`);
            }
        }
        this.network = networkConfig;
        this.chain = this.network.selector;
        for (const provider of this.network.providers) {
            this.withAPI(provider);
        }
    }

    public withAPI(
        api: BitcoinAPI | APIWithPriority,
        { priority = 0 } = {},
    ): this {
        this.api.withAPI(api, { priority });
        return this;
    }

    public getOutputPayload(
        asset: string,
        _inputType: InputType,
        _outputType: OutputType,
        toPayload: BitcoinReleasePayload,
    ): {
        to: string;
        toBytes: Buffer;
        payload: Buffer;
    } {
        this._assertAssetIsSupported(asset);
        return {
            to: toPayload.address,
            toBytes: this.decodeAddress(toPayload.address),
            payload: Buffer.from([]),
        };
    }

    public addressExplorerLink(address: string): string | undefined {
        return this.network.explorer.address(address);
    }

    public transactionExplorerLink(tx: ChainTransaction): string | undefined {
        return this.network.explorer.transaction(
            this.formattedTransactionHash(tx),
        );
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

    public encodeAddress(bytes: Buffer): string {
        return base58.encode(bytes);
    }

    public decodeAddress(address: string): Buffer {
        return addressToBytes(address);
    }

    public validateAddress(address: string): boolean {
        return validateAddress(
            address,
            this.network.nativeAsset.symbol,
            this.network.isTestnet ? "testnet" : "prod",
        );
    }

    public formattedTransactionHash(transaction: {
        txid: string;
        txindex: string;
    }): string {
        return utils.fromBase64(transaction.txid).reverse().toString("hex");
    }

    public validateTransaction(transaction: ChainTransaction): boolean {
        return (
            utils.fromBase64(transaction.txid).length === 32 &&
            !new BigNumber(transaction.txindex).isNaN()
        );
    }

    /**
     * See [[LockChain.isLockAsset]].
     */
    public isLockAsset(asset: string): boolean {
        return asset === this.network.nativeAsset.symbol;
    }

    public isDepositAsset(asset: string): boolean {
        this._assertAssetIsSupported(asset);
        return true;
    }

    private _assertAssetIsSupported(asset: string) {
        if (!this.isLockAsset(asset)) {
            throw new Error(`Asset ${asset} not supported on ${this.chain}.`);
        }
    }

    /**
     * See [[LockChain.assetDecimals]].
     */
    public assetDecimals(asset: string): number {
        this._assertAssetIsSupported(asset);
        return 8;
    }

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

        try {
            const txs = await utils.tryNTimes(
                async () => this.api.fetchTXs(address),
                2,
            );
            txs.map((tx) =>
                onInput({
                    chain: this.chain,
                    txid: utils.toURLBase64(utils.fromHex(tx.txid).reverse()),
                    txidFormatted: tx.txid,
                    txindex: tx.txindex,

                    asset,
                    amount: tx.amount,
                }),
            );
        } catch (error) {
            // Ignore error and fallback to getUTXOs.
        }

        while (true) {
            if (listenerCancelled()) {
                return;
            }
            try {
                const utxos = await this.api.fetchUTXOs(address);
                utxos.map((tx) =>
                    onInput({
                        chain: this.chain,
                        txid: utils.toURLBase64(
                            utils.fromHex(tx.txid).reverse(),
                        ),
                        txidFormatted: tx.txid,
                        txindex: tx.txindex,

                        asset,
                        amount: tx.amount,
                    }),
                );
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
            } catch (error: any) {
                console.error(error);
            }
            await utils.sleep(15 * utils.sleep.SECONDS);
        }
    }

    /**
     * See [[LockChain.transactionConfidence]].
     */
    public transactionConfidence = async (
        transaction: ChainTransaction,
    ): Promise<BigNumber> => {
        const { height } = await this.api.fetchUTXO(
            this.formattedTransactionHash(transaction),
            transaction.txindex,
        );
        if (!height) {
            return new BigNumber(0);
        } else {
            const latestHeight = new BigNumber(await this.api.fetchHeight());
            return latestHeight.minus(height).plus(1);
        }
    };

    /**
     * See [[LockChain.getGatewayAddress]].
     */
    public createGatewayAddress(
        asset: string,
        fromPayload: { chain: string },
        shardPublicKey: Buffer,
        gHash: Buffer,
    ): Promise<string> | string {
        this._assertAssetIsSupported(asset);
        if (fromPayload.chain !== this.chain) {
            throw new Error(
                `Invalid payload for chain ${fromPayload.chain} instead of ${this.chain}.`,
            );
        }
        return this.encodeAddress(
            createAddressBuffer(
                hash160(shardPublicKey),
                gHash,
                this.network.p2shPrefix,
            ),
        );
    }

    // Methods for initializing mints and burns ////////////////////////////////

    /**
     * When burning, you can call `Bitcoin.Address("...")` to make the address
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
     * When burning, you can call `Bitcoin.Address("...")` to make the address
     * available to the burn params.
     *
     * @category Main
     */
    public GatewayAddress(): { chain: string } {
        return {
            chain: this.chain,
        };
    }

    public toSats(value: BigNumber | string | number): string {
        return new BigNumber(value).shiftedBy(8).decimalPlaces(0).toFixed();
    }

    public fromSats(value: BigNumber | string | number): string {
        return new BigNumber(value).shiftedBy(-8).toFixed();
    }
}
