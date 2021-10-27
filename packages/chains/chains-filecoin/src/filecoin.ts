import BigNumber from "bignumber.js";
import { blake2b } from "blakejs";
import CID from "cids";
import elliptic from "elliptic";

import {
    decode as decodeAddress,
    encode as encodeAddress,
    validateAddressString,
} from "@glif/filecoin-address";
import FilecoinClient from "@glif/filecoin-rpc-client";
import {
    assertType,
    ChainTransaction,
    DepositChain,
    doesntError,
    fromBase64,
    InputChainTransaction,
    OutputType,
    RenNetwork,
    RenNetworkString,
    SECONDS,
    sleep,
    toURLBase64,
    tryNTimes,
} from "@renproject/utils";

import { FilTransaction } from "./utils/deposit";
import { Filfox } from "./utils/filfox";
import { fetchDeposits, fetchMessage, getHeight } from "./utils/lotus";

interface FilecoinConfig {}

export interface FilecoinNetworkConfig {
    selector: string;
    nativeAsset: {
        name: string;
        symbol: string;
        decimals: number;
    };
    addressPrefix: string;
    explorer: string;

    // RPC details
    rpc: {
        apiAddress: string;
        token?: string;
    };

    filfoxAPI?: string;
}

export const isFilecoinNetworkConfig = (
    renNetwork: unknown,
): renNetwork is FilecoinNetworkConfig =>
    !!(renNetwork as FilecoinNetworkConfig).selector &&
    !!(renNetwork as FilecoinNetworkConfig).nativeAsset &&
    !!(renNetwork as FilecoinNetworkConfig).rpc &&
    !!(renNetwork as FilecoinNetworkConfig).addressPrefix &&
    !!(renNetwork as FilecoinNetworkConfig).explorer;

export const FilecoinMainnet: FilecoinNetworkConfig = {
    selector: "Filecoin",

    nativeAsset: {
        name: "Filecoin",
        symbol: "FIL",
        decimals: 18,
    },

    addressPrefix: "f",
    explorer: "https://filfox.info/en/",

    rpc: {
        apiAddress: `https://multichain-web-proxy.herokuapp.com/mainnet`,
    },

    filfoxAPI: "https://filfox.info/api/v1/",
};

export const FilecoinTestnet: FilecoinNetworkConfig = {
    selector: "Filecoin",

    nativeAsset: {
        name: "Filecoin",
        symbol: "FIL",
        decimals: 18,
    },

    addressPrefix: "t",
    explorer: "https://filfox.info/en/",

    rpc: {
        apiAddress: `https://multichain-web-proxy.herokuapp.com/testnet`,
    },
};

export type FilecoinNetworkConfigMap = {
    [network in RenNetwork]?: FilecoinNetworkConfig;
};

export const FilecoinConfigMap = {
    [RenNetwork.Mainnet]: FilecoinMainnet,
    [RenNetwork.Testnet]: FilecoinTestnet,
    [RenNetwork.Devnet]: FilecoinTestnet,
};

export interface FilecoinReleasePayload {
    chain: string;
    address: string;
}

export class Filecoin
    implements DepositChain<{ chain: string }, FilecoinReleasePayload>
{
    public static chain = "Filecoin";
    public chain: string;

    public static configMap = FilecoinConfigMap;
    public configMap = FilecoinConfigMap;

    public network: FilecoinNetworkConfig;

    public feeAsset = "FIL";

    public client: FilecoinClient | undefined;
    public clientOptions: FilecoinConfig;

    public filfox: Filfox | undefined;

    constructor(
        network: RenNetwork | RenNetworkString | FilecoinNetworkConfig,
        options: FilecoinConfig = {},
    ) {
        const networkConfig = isFilecoinNetworkConfig(network)
            ? network
            : FilecoinConfigMap[network];
        if (!networkConfig) {
            if (typeof network === "string") {
                throw new Error(`Invalid RenVM network ${network}.`);
            } else {
                throw new Error(`Invalid Filecoin network config.`);
            }
        }

        this.network = networkConfig;
        this.chain = this.network.selector;
        this.clientOptions = options;

        this.client = new FilecoinClient(this.network.rpc);

        if (this.network.filfoxAPI) {
            this.filfox = new Filfox(this.network.filfoxAPI);
        }
    }

    public validateAddress = (address: string) =>
        validateAddressString(address);

    public validateTransaction = doesntError(
        (tx: ChainTransaction) =>
            new CID(fromBase64(tx.txid)).bytes.length === 38 &&
            tx.txindex === "0",
    );

    public addressExplorerLink = (address: string): string => {
        // TODO: Check network.
        return `https://filfox.info/en/address/${address}`;
    };

    public transactionExplorerLink = (
        transaction: ChainTransaction,
    ): string => {
        // TODO: Check network.
        return `https://filfox.info/en/message/${this.transactionHash(
            transaction,
        )}`;
    };

    /**
     * See [[LockChain.assetIsNative]].
     */
    assetIsNative = (asset: string): boolean => asset === this.feeAsset;
    assetIsSupported = this.assetIsNative;

    public readonly assertAssetIsSupported = (asset: string) => {
        if (!this.assetIsNative(asset)) {
            throw new Error(`Asset ${asset} not supported on ${this.chain}.`);
        }
    };

    /**
     * See [[LockChain.assetDecimals]].
     */
    assetDecimals = (asset: string): number => {
        this.assertAssetIsSupported(asset);
        return this.network.nativeAsset.decimals;
    };

    watchForDeposits = async (
        asset: string,
        fromPayload: { chain: string },
        address: string,
        onInput: (input: InputChainTransaction) => void,
        _removeInput: (input: InputChainTransaction) => void,
        listenerCancelled: () => boolean,
    ): Promise<void> => {
        if (fromPayload.chain !== this.chain) {
            throw new Error(
                `Invalid payload for chain ${fromPayload.chain} instead of ${this.chain}.`,
            );
        }
        this.assertAssetIsSupported(asset);

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
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
            } catch (error: any) {
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
                        const { deposits, totalCount } = await tryNTimes(
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
                            5 * SECONDS,
                        );

                        await Promise.all(
                            (deposits || []).map(async (tx) =>
                                onInput({
                                    chain: this.chain,
                                    txid: toURLBase64(
                                        Buffer.from(new CID(tx.cid).bytes),
                                    ),
                                    txindex: "0",
                                    amount: tx.amount,
                                }),
                            ),
                        );

                        if (size * (page + 1) >= totalCount) {
                            break;
                        }

                        page += 1;

                        await sleep(10 * SECONDS);
                    }
                    fetched = true;
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                } catch (error: any) {
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
                    (txs || []).map(async (tx) =>
                        onInput({
                            chain: this.chain,
                            txid: toURLBase64(
                                Buffer.from(new CID(tx.cid).bytes),
                            ),
                            txindex: "0",
                            amount: tx.amount,
                        }),
                    ),
                );
            }

            progress = height;

            await sleep(15 * SECONDS);
        }
    };

    /**
     * See [[LockChain.transactionConfidence]].
     */
    transactionConfidence = async (
        transaction: ChainTransaction,
    ): Promise<BigNumber> => {
        const cid = this.transactionHash(transaction);
        let msg;
        try {
            msg = await fetchMessage(
                this.client,
                cid,
                this.network.addressPrefix,
            );
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } catch (error: any) {
            if (this.filfox) {
                try {
                    msg = await this.filfox.fetchMessage(cid);
                } catch (errorInner) {
                    console.error(errorInner);
                }
            }
            throw error;
        }
        return new BigNumber(msg.confirmations);
    };

    isDepositAsset = (asset: string) => {
        this.assertAssetIsSupported(asset);
        return true;
    };

    public getBalance = async (
        asset: string,
        address: string,
        // eslint-disable-next-line @typescript-eslint/require-await
    ): Promise<BigNumber> => {
        this.assertAssetIsSupported(asset);
        if (!this.validateAddress(address)) {
            throw new Error(`Invalid address ${address}.`);
        }
        // TODO: Implement.
        return new BigNumber(0);
    };

    /**
     * See [[LockChain.getGatewayAddress]].
     */
    createGatewayAddress = (
        asset: string,
        fromPayload: { chain: string },
        shardPublicKey: Buffer,
        gHash: Buffer,
    ): Promise<string> | string => {
        if (fromPayload.chain !== this.chain) {
            throw new Error(
                `Invalid payload for chain ${fromPayload.chain} instead of ${this.chain}.`,
            );
        }

        this.assertAssetIsSupported(asset);

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

        const payload = Buffer.from(
            blake2b(
                Buffer.from(derivedPublicKey.getPublic(false, "hex"), "hex"),
                null,
                20,
            ),
        );

        return this.encodeFilecoinAddress(payload);
    };

    encodeFilecoinAddress = (payload: Buffer) => {
        if (payload.length === 21) {
            payload = Buffer.from(payload.slice(1, 21));
        }
        // secp256k1 protocol prefix
        const protocol = 1;

        const addressObject = {
            str: Buffer.concat([Buffer.from([protocol]), payload]),
            protocol: () => protocol,
            payload: () => payload,
        };

        return encodeAddress(this.network.addressPrefix, addressObject);
    };

    /**
     * See [[LockChain.addressToBytes]].
     */
    addressToBytes = (address: string): Buffer =>
        Buffer.from(decodeAddress(address).str);

    /**
     * See [[LockChain.addressToBytes]].
     */
    bytesToAddress = (address: Buffer): string =>
        this.encodeFilecoinAddress(address);

    /**
     * See [[LockChain.transactionID]].
     */
    transactionID = (transaction: FilTransaction): string => transaction.cid;

    transactionHash = (tx: ChainTransaction): string =>
        new CID(fromBase64(tx.txid)).toString();

    transactionRPCTxidFromID = (transactionID: string): Buffer =>
        Buffer.from(new CID(transactionID).bytes);

    getBurnPayload: ((bytes?: boolean) => string) | undefined;

    /** @category Main */
    Address = (address: string): this => {
        // Type validation
        assertType<string>("string", { address });

        this.getBurnPayload = (bytes) =>
            bytes ? this.addressToBytes(address).toString("hex") : address;
        return this;
    };

    public getOutputPayload = (
        asset: string,
        _type: OutputType.Release,
        toPayload: FilecoinReleasePayload,
    ): {
        to: string;
        payload: Buffer;
    } => {
        this.assertAssetIsSupported(asset);
        return {
            to: toPayload.address,
            payload: Buffer.from([]),
        };
    };
}
