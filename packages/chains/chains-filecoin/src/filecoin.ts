import { InputType } from "zlib";

import {
    Address,
    decode as decodeAddress,
    encode as encodeAddress,
    validateAddressString,
} from "@glif/filecoin-address";
import FilecoinClient from "@glif/filecoin-rpc-client";
import {
    assertType,
    ChainTransaction,
    DepositChain,
    ErrorWithCode,
    InputChainTransaction,
    OutputType,
    populateChainTransaction,
    RenJSError,
    RenNetwork,
    utils,
} from "@renproject/utils";
import BigNumber from "bignumber.js";
import { blake2b } from "blakejs";
import elliptic from "elliptic";

import { FilTransaction } from "./utils/deposit";
import { Filfox } from "./utils/filfox";
import { fetchDeposits, fetchMessage, getHeight } from "./utils/lotus";
import { txHashFromBytes, txHashToBytes } from "./utils/utils";

interface FilecoinConfig {}

export interface FilecoinNetworkConfig {
    selector: string;
    nativeAsset: {
        name: string;
        symbol: string;
        decimals: number;
    };
    averageConfirmationTime: number;
    addressPrefix: string;
    explorer: string;
    isTestnet?: boolean;

    // RPC details
    rpc: {
        apiAddress: string;
        token?: string;
    };

    filfoxAPI?: string;
}

const isFilecoinNetworkConfig = (
    renNetwork: unknown,
): renNetwork is FilecoinNetworkConfig =>
    !!(renNetwork as FilecoinNetworkConfig).selector &&
    !!(renNetwork as FilecoinNetworkConfig).nativeAsset &&
    !!(renNetwork as FilecoinNetworkConfig).rpc &&
    !!(renNetwork as FilecoinNetworkConfig).addressPrefix &&
    !!(renNetwork as FilecoinNetworkConfig).explorer;

const FilecoinMainnet: FilecoinNetworkConfig = {
    selector: "Filecoin",

    nativeAsset: {
        name: "Filecoin",
        symbol: "FIL",
        decimals: 18,
    },

    averageConfirmationTime: 30,

    addressPrefix: "f",
    explorer: "https://filfox.info/en",

    rpc: {
        apiAddress: `https://api.node.glif.io`,
    },

    filfoxAPI: "https://filfox.info/api/v1/",
};

const FilecoinTestnet: FilecoinNetworkConfig = {
    selector: "Filecoin",
    isTestnet: true,

    nativeAsset: {
        name: "Filecoin",
        symbol: "FIL",
        decimals: 18,
    },

    averageConfirmationTime: 30,

    addressPrefix: "t",
    explorer: "https://calibration.filscan.io",

    rpc: {
        apiAddress: `https://api.calibration.node.glif.io`,
    },
};

export type FilecoinInputPayload =
    | {
          chain: string;
          type?: "gatewayAddress";
      }
    | {
          chain: string;
          type: "transaction";
          params: {
              tx: ChainTransaction;
          };
      };

export interface FilecoinOutputPayload {
    chain: string;
    type?: "address";
    params: {
        address: string;
    };
}

export class Filecoin
    implements DepositChain<FilecoinInputPayload, FilecoinOutputPayload>
{
    public static chain = "Filecoin" as const;
    public chain: string;
    public static assets = {
        [RenNetwork.Mainnet]: { FIL: "FIL" as const },
        [RenNetwork.Testnet]: { FIL: "FIL" as const },
    };
    public assets:
        | typeof Filecoin.assets[RenNetwork.Mainnet]
        | typeof Filecoin.assets[RenNetwork.Testnet];

    public static configMap = {
        [RenNetwork.Mainnet]: FilecoinMainnet,
        [RenNetwork.Testnet]: FilecoinTestnet,
    };
    public configMap = Filecoin.configMap;

    public network: FilecoinNetworkConfig;

    public client: FilecoinClient;
    public clientOptions: FilecoinConfig;

    public filfox: Filfox | undefined;

    public constructor({
        network,
        options,
    }: {
        network: RenNetwork | `${RenNetwork}` | FilecoinNetworkConfig;
        options?: FilecoinConfig;
    }) {
        const networkConfig = isFilecoinNetworkConfig(network)
            ? network
            : Filecoin.configMap[network];
        if (!networkConfig) {
            if (typeof network === "string") {
                throw new Error(`Invalid RenVM network ${network}.`);
            } else {
                throw new Error(`Invalid Filecoin network config.`);
            }
        }

        this.network = networkConfig;
        this.chain = this.network.selector;
        this.assets =
            Filecoin.assets[
                this.network.isTestnet ? RenNetwork.Testnet : RenNetwork.Mainnet
            ];
        this.clientOptions = options || {};

        this.client = new FilecoinClient(this.network.rpc);

        if (this.network.filfoxAPI) {
            this.filfox = new Filfox(this.network.filfoxAPI);
        }
    }

    public validateAddress = (address: string): boolean => {
        return validateAddressString(address);
    };

    public validateTransaction = (
        transaction: Partial<ChainTransaction> &
            ({ txid: string } | { txHash: string }),
    ): boolean => {
        return (
            (utils.isDefined(transaction.txid) ||
                utils.isDefined(transaction.txHash)) &&
            (transaction.txHash
                ? this.txHashToBytes(transaction.txHash).length === 38
                : true) &&
            (transaction.txid
                ? utils.isURLBase64(transaction.txid, {
                      length: 38,
                  })
                : true) &&
            (transaction.txindex
                ? !new BigNumber(transaction.txindex).isNaN()
                : true) &&
            (transaction.txHash && transaction.txid
                ? utils.toURLBase64(this.txHashToBytes(transaction.txHash)) ===
                  transaction.txid
                : true) &&
            (transaction.txindex === undefined || transaction.txindex === "0")
        );
    };

    public addressExplorerLink = (address: string): string => {
        const explorer = this.network.explorer;

        if (explorer.match(/filscan/)) {
            return `${explorer}/address/general?address=${address}`;
        }

        return `${explorer}/address/${address}`;
    };

    public transactionExplorerLink = ({
        txid,
        txHash,
    }: Partial<ChainTransaction> & ({ txid: string } | { txHash: string })):
        | string
        | undefined => {
        const hash =
            txHash ||
            (txid && this.txHashFromBytes(utils.fromBase64(txid))) ||
            undefined;
        if (!hash) {
            return undefined;
        }

        const explorer = this.network.explorer;

        if (explorer.match(/filscan/)) {
            return `${explorer}/tipset/message-detail?cid=${hash}`;
        }

        return `${explorer}/message/${hash}`;
    };

    /**
     * See [[LockChain.isLockAsset]].
     */
    public isLockAsset = (asset: string): boolean => {
        return asset === this.network.nativeAsset.symbol;
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
        return this.network.nativeAsset.decimals;
    };

    public watchForDeposits = async (
        asset: string,
        fromPayload: FilecoinInputPayload,
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
                    let tx: FilTransaction;

                    try {
                        if (this.filfox) {
                            tx = await this.filfox.fetchMessage(inputTx.txHash);
                        } else {
                            tx = await fetchMessage(
                                this.client,
                                inputTx.txHash,
                                this.network.addressPrefix,
                            );
                        }
                        onInput({
                            chain: this.chain,
                            txid: utils.toURLBase64(txHashToBytes(tx.cid)),
                            txHash: tx.cid,
                            txindex: "0",

                            explorerLink:
                                this.transactionExplorerLink({
                                    txHash: tx.cid,
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

        // If there's too many logs to catch-up on, fetch the transactions from
        // Filfox (mainnet only)

        let progress = 0;

        while (true) {
            if (listenerCancelled()) {
                return;
            }

            let height: number = 0;
            try {
                height = await getHeight(this.client);
            } catch (error: unknown) {
                console.error(error);
            }

            const logLimit = 100;
            const fromBlock = height - logLimit;
            const logsToCatchUp = height - progress;
            let fetched = false;

            if (this.filfox && (logsToCatchUp > logLimit || height === 0)) {
                try {
                    const size = 100;
                    let page = 0;

                    while (true) {
                        const { deposits, totalCount } = await utils.tryNTimes(
                            async () => {
                                if (!this.filfox) {
                                    throw new Error(`Filfox not defined.`);
                                }
                                return this.filfox.fetchDeposits(
                                    address,
                                    page,
                                    size,
                                );
                            },
                            5,
                            5 * utils.sleep.SECONDS,
                        );

                        await Promise.all(
                            (deposits || []).map((tx) =>
                                onInput({
                                    chain: this.chain,
                                    txid: utils.toURLBase64(
                                        txHashToBytes(tx.cid),
                                    ),
                                    txHash: tx.cid,
                                    txindex: "0",

                                    explorerLink:
                                        this.transactionExplorerLink({
                                            txHash: tx.cid,
                                        }) || "",

                                    asset,
                                    amount: tx.amount,
                                }),
                            ),
                        );

                        if (size * (page + 1) >= totalCount) {
                            break;
                        }

                        page += 1;

                        await utils.sleep(10 * utils.sleep.SECONDS);
                    }
                    fetched = true;
                } catch (error: unknown) {
                    // Ignore error.
                }
            }

            if (!fetched) {
                const txs: FilTransaction[] = await fetchDeposits(
                    this.client,
                    address,
                    this.network.addressPrefix,
                    fromBlock,
                    height,
                );

                await Promise.all(
                    (txs || []).map((tx) =>
                        onInput({
                            chain: this.chain,
                            txid: utils.toURLBase64(txHashToBytes(tx.cid)),
                            txHash: tx.cid,
                            txindex: "0",

                            explorerLink:
                                this.transactionExplorerLink({
                                    txHash: tx.cid,
                                }) || "",

                            asset,
                            amount: tx.amount,
                        }),
                    ),
                );
            }

            progress = height;

            await utils.sleep(15 * utils.sleep.SECONDS);
        }
    };

    /**
     * See [[LockChain.transactionConfidence]].
     */
    public transactionConfidence = async (
        transaction: ChainTransaction,
    ): Promise<BigNumber> => {
        let msg;
        try {
            msg = await fetchMessage(
                this.client,
                transaction.txHash,
                this.network.addressPrefix,
            );
        } catch (error: unknown) {
            if (this.filfox) {
                try {
                    msg = await this.filfox.fetchMessage(transaction.txHash);
                } catch (errorInner) {
                    console.error(errorInner);
                }
            }
            throw error;
        }
        return new BigNumber(msg.confirmations);
    };

    public isDepositAsset = (asset: string): boolean => {
        return asset === this.network.nativeAsset.symbol;
    };

    public getBalance = (
        asset: string,
        address: string,
        // eslint-disable-next-line @typescript-eslint/require-await
    ): BigNumber => {
        this._assertAssetIsSupported(asset);
        if (!this.validateAddress(address)) {
            throw new Error(`Invalid address ${address}.`);
        }
        // TODO: Implement.
        return new BigNumber(0);
    };

    /**
     * See [[LockChain.getGatewayAddress]].
     */
    public createGatewayAddress = (
        asset: string,
        fromPayload: FilecoinInputPayload,
        shardPublicKey: Uint8Array,
        gHash: Uint8Array,
    ): string => {
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

        const bytes = new Uint8Array(
            blake2b(
                utils.fromHex(derivedPublicKey.getPublic(false, "hex")),
                null,
                20,
            ),
        );

        return this.addressFromBytes(bytes);
    };

    public addressToBytes = (address: string): Uint8Array => {
        return new Uint8Array(decodeAddress(address).str);
    };

    public addressFromBytes = (bytes: Uint8Array): string => {
        if (bytes.length === 21) {
            bytes = new Uint8Array(bytes.slice(1, 21));
        }
        // secp256k1 protocol prefix
        const protocol = 1;

        const addressObject = {
            str: utils.concat([new Uint8Array([protocol]), bytes]),
            protocol: () => protocol,
            payload: () => bytes,
        };

        return encodeAddress(
            this.network.addressPrefix,
            addressObject as unknown as Address,
        );
    };

    public txHashToBytes = (txHash: string): Uint8Array => {
        return txHashToBytes(txHash);
    };

    public txHashFromBytes = (bytes: Uint8Array): string => {
        return txHashFromBytes(bytes);
    };

    public getOutputPayload = (
        asset: string,
        _inputType: InputType,
        _outputType: OutputType,
        toPayload: FilecoinOutputPayload,
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

    public populateChainTransaction = (
        partialTx: Partial<ChainTransaction> &
            ({ txid: string } | { txHash: string }),
    ): ChainTransaction => {
        return populateChainTransaction({
            partialTx,
            chain: this.chain,
            txHashToBytes,
            txHashFromBytes,
            defaultTxindex: "0",
            explorerLink: this.transactionExplorerLink,
        });
    };

    // Methods for initializing mints and burns ////////////////////////////////

    /**
     * When burning, you can call `Filecoin.Address("...")` to make the address
     * available to the burn params.
     *
     * @category Main
     */
    public Address = (address: string): FilecoinOutputPayload => {
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
     * When burning, you can call `Filecoin.Address("...")` to make the address
     * available to the burn params.
     *
     * @category Main
     */
    public GatewayAddress = (): FilecoinInputPayload => {
        return {
            chain: this.chain,
        };
    };

    /**
     * Import an existing Filecoin transaction instead of watching for deposits
     * to a gateway address.
     *
     * @example
     * filecoin.Transaction({
     *   txHash: "bafy2bzaceaoo4msi45t3pbhfov3guu5l34ektpjhuftyddy2rvhf2o5ajijle",
     * })
     */
    public Transaction = (
        partialTx: Partial<ChainTransaction> &
            ({ txid: string } | { txHash: string }),
    ): FilecoinInputPayload => {
        return {
            chain: this.chain,
            type: "transaction",
            params: {
                tx: this.populateChainTransaction(partialTx),
            },
        };
    };
}
