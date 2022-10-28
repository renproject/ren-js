import {
    assertType,
    ChainTransaction,
    DepositChain,
    ErrorWithCode,
    InputChainTransaction,
    InputType,
    OutputType,
    populateChainTransaction,
    RenJSError,
    utils,
} from "@renproject/utils";
import BigNumber from "bignumber.js";
import base58 from "bs58";
import { validate } from "wallet-address-validator";

import { APIWithPriority, BitcoinAPI, CombinedAPI } from "./APIs/API";
import { createAddressArray } from "./script/index";
import {
    BitcoinInputPayload,
    BitcoinNetworkConfig,
    BitcoinNetworkConfigMap,
    BitcoinNetworkInput,
    BitcoinOutputPayload,
    isBitcoinNetworkConfig,
} from "./utils/types";
import {
    addressToBytes,
    hash160,
    txHashFromBytes,
    txHashToBytes,
} from "./utils/utils";

/**
 * A base Bitcoin chain class that is extended by each Bitcoin chain/fork.
 */
export abstract class BitcoinBaseChain
    implements DepositChain<BitcoinInputPayload, BitcoinOutputPayload>
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

    public withAPI = (
        api: BitcoinAPI | APIWithPriority,
        { priority = 0 } = {},
    ): this => {
        this.api.withAPI(api, { priority });
        return this;
    };

    public getOutputPayload = (
        asset: string,
        _inputType: InputType,
        _outputType: OutputType,
        toPayload: BitcoinOutputPayload,
    ):
        | {
              to: string;
              toBytes: Uint8Array;
              payload: Uint8Array;
          }
        | undefined => {
        this._assertAssetIsSupported(asset);
        const address = toPayload.params.address;
        if (!address) {
            // throw new Error(`No ${this.chain} address specified.`);
            return undefined;
        }
        return {
            to: address,
            toBytes: this.addressToBytes(address),
            payload: new Uint8Array(),
        };
    };

    public addressExplorerLink = (address: string): string | undefined => {
        return this.network.explorer.address(address);
    };

    public transactionExplorerLink = ({
        txid,
        txHash,
    }: Partial<ChainTransaction> & ({ txid: string } | { txHash: string })):
        | string
        | undefined => {
        if (txHash) {
            return this.network.explorer.transaction(txHash);
        } else if (txid) {
            return this.network.explorer.transaction(
                this.txHashFromBytes(utils.fromBase64(txid)),
            );
        }
        return undefined;
    };

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

    public validateAddress = (address: string): boolean => {
        try {
            return validate(
                address,
                this.network.nativeAsset.symbol,
                this.network.isTestnet ? "testnet" : "prod",
            );
        } catch (error) {
            return false;
        }
    };

    public addressToBytes = (address: string): Uint8Array => {
        return addressToBytes(address);
    };

    public addressFromBytes = (bytes: Uint8Array): string => {
        return base58.encode(bytes);
    };

    public txHashToBytes = (txHash: string): Uint8Array => {
        return txHashToBytes(txHash);
    };

    public txHashFromBytes = (bytes: Uint8Array): string => {
        return txHashFromBytes(bytes);
    };

    public validateTransaction = (
        transaction: Partial<ChainTransaction> &
            ({ txid: string } | { txHash: string }),
    ): boolean => {
        return (
            (utils.isDefined(transaction.txid) ||
                utils.isDefined(transaction.txHash)) &&
            (transaction.txHash
                ? utils.isHex(transaction.txHash, {
                      length: 32,
                  })
                : true) &&
            (transaction.txid
                ? utils.isURLBase64(transaction.txid, {
                      length: 32,
                  })
                : true) &&
            (transaction.txindex
                ? !new BigNumber(transaction.txindex).isNaN()
                : true) &&
            (transaction.txHash && transaction.txid
                ? utils.toURLBase64(txHashToBytes(transaction.txHash)) ===
                  transaction.txid
                : true)
        );
    };

    /**
     * See [[LockChain.isLockAsset]].
     */
    public isLockAsset = (asset: string): boolean => {
        return asset === this.network.nativeAsset.symbol;
    };

    public isDepositAsset = (asset: string): boolean => {
        this._assertAssetIsSupported(asset);
        return true;
    };

    private _assertAssetIsSupported = (asset: string) => {
        if (!this.isLockAsset(asset)) {
            throw new Error(`Asset ${asset} not supported on ${this.chain}.`);
        }
    };

    /**
     * See [[LockChain.assetDecimals]].
     */
    public assetDecimals = (asset: string): number => {
        this._assertAssetIsSupported(asset);
        return 8;
    };

    public watchForDeposits = async (
        asset: string,
        fromPayload: BitcoinInputPayload,
        address: string,
        onInput: (input: InputChainTransaction) => void,
        _removeInput: (input: InputChainTransaction) => void,
        listenerCancelled: () => boolean,
    ): Promise<void> => {
        this._assertAssetIsSupported(asset);
        if (fromPayload.chain !== this.chain) {
            throw new Error(
                `Invalid payload for chain ${fromPayload.chain} instead of ${this.chain}.`,
            );
        }

        // If the payload is a transaction, submit it to onInput and then loop
        // indefinitely.
        if (fromPayload.type === "transaction") {
            const inputTx = fromPayload.params.tx;
            if ((inputTx as InputChainTransaction).amount === undefined) {
                while (true) {
                    try {
                        const tx = await this.api.fetchUTXO(
                            inputTx.txHash,
                            inputTx.txindex,
                        );
                        onInput({
                            chain: this.chain,
                            txid: utils.toURLBase64(
                                utils.fromHex(tx.txid).reverse(),
                            ),
                            txHash: tx.txid,
                            txindex: tx.txindex,
                            explorerLink:
                                this.transactionExplorerLink({
                                    txHash: tx.txid,
                                }) || "",

                            asset,
                            amount: tx.amount,
                        });
                        break;
                    } catch (error: unknown) {
                        console.error(error);
                    }
                }

                while (true) {
                    await utils.sleep(15 * utils.sleep.SECONDS);
                }
            }
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
                    txHash: tx.txid,
                    txindex: tx.txindex,
                    explorerLink:
                        this.transactionExplorerLink({
                            txHash: tx.txid,
                        }) || "",

                    asset,
                    amount: tx.amount,
                }),
            );
        } catch (error: unknown) {
            // Ignore error and fallback to getUTXOs.
        }

        while (!listenerCancelled()) {
            try {
                const utxos = await this.api.fetchUTXOs(address);
                utxos.map((tx) =>
                    onInput({
                        chain: this.chain,
                        txid: utils.toURLBase64(
                            utils.fromHex(tx.txid).reverse(),
                        ),
                        txHash: tx.txid,
                        txindex: tx.txindex,
                        explorerLink:
                            this.transactionExplorerLink({
                                txHash: tx.txid,
                            }) || "",

                        asset,
                        amount: tx.amount,
                    }),
                );
            } catch (error: unknown) {
                console.error(error);
            }
            await utils.sleep(15 * utils.sleep.SECONDS);
        }
    };

    /**
     * See [[LockChain.transactionConfidence]].
     */
    public transactionConfidence = async (
        transaction: ChainTransaction,
    ): Promise<BigNumber> => {
        const { height } = await this.api.fetchUTXO(
            transaction.txHash,
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
    public createGatewayAddress = (
        asset: string,
        fromPayload: BitcoinInputPayload,
        shardPublicKey: Uint8Array,
        gHash: Uint8Array,
    ): Promise<string> | string => {
        this._assertAssetIsSupported(asset);
        if (fromPayload.chain !== this.chain) {
            throw new Error(
                `Invalid payload for chain ${fromPayload.chain} instead of ${this.chain}.`,
            );
        }
        return this.addressFromBytes(
            createAddressArray(
                hash160(shardPublicKey),
                gHash,
                this.network.p2shPrefix,
            ),
        );
    };

    public populateChainTransaction = (
        partialTx: Partial<ChainTransaction> &
            ({ txid: string } | { txHash: string }),
    ): ChainTransaction => {
        return populateChainTransaction({
            partialTx,
            chain: this.chain,
            txHashToBytes,
            txHashFromBytes,
            explorerLink: this.transactionExplorerLink,
        });
    };

    // Methods for initializing mints and burns ////////////////////////////////

    /**
     * When burning, you can call `Bitcoin.Address("...")` to make the address
     * available to the burn params.
     *
     * @category Main
     */
    public Address = (address: string): BitcoinOutputPayload => {
        // Type validation
        assertType<string>("string", { address });

        if (!this.validateAddress(address)) {
            throw ErrorWithCode.updateError(
                new Error(`Invalid ${this.chain} address: ${String(address)}`),
                RenJSError.PARAMETER_ERROR,
            );
        }

        return {
            chain: this.chain,
            type: "address",
            params: {
                address,
            },
        };
    };

    /**
     * When burning, you can call `Bitcoin.Address("...")` to make the address
     * available to the burn params.
     *
     * @category Main
     */
    public GatewayAddress = (): BitcoinInputPayload => {
        return {
            chain: this.chain,
            type: "gatewayAddress",
        };
    };

    /**
     * Import an existing Bitcoin transaction instead of watching for deposits
     * to a gateway address.
     *
     * @example
     * bitcoin.Transaction({
     *   txHash: "a1075db55d416d3ca199f55b6084e2115b9345e16c5cf302fc80e9d5fbf5d48d",
     *   txindex: "0"
     * })
     */
    public Transaction = (
        partialTx: Partial<ChainTransaction> & { txindex: string } & (
                | { txid: string }
                | { txHash: string }
            ),
    ): BitcoinInputPayload => {
        return {
            chain: this.chain,
            type: "transaction",
            params: {
                tx: this.populateChainTransaction(partialTx),
            },
        };
    };

    public toSats = (value: BigNumber | string | number): string => {
        return new BigNumber(value).shiftedBy(8).decimalPlaces(0).toFixed();
    };

    public fromSats = (value: BigNumber | string | number): string => {
        return new BigNumber(value).shiftedBy(-8).toFixed();
    };
}
