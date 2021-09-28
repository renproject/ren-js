import bech32 from "bech32";
import BigNumber from "bignumber.js";
import base58 from "bs58";

import {
    ChainTransaction,
    DepositChain,
    RenNetwork,
    RenNetworkString,
} from "@renproject/interfaces";
import {
    assertType,
    fromHex,
    hash160,
    retryNTimes,
    strip0x,
    toBase64,
} from "@renproject/utils";

import { APIWithPriority, BitcoinAPI, CombinedAPI, UTXO } from "./APIs/API";
import { Blockchair, BlockchairNetwork } from "./APIs/blockchair";
import { Blockstream } from "./APIs/blockstream";
import { SoChain, SoChainNetwork } from "./APIs/sochain";
import { createAddressBuffer } from "./script/index";

export type BtcNetwork = "mainnet" | "testnet" | "regtest";

// const transactionToDeposit = (transaction: BtcTransaction) => ({
//     transaction,
//     amount: transaction.amount.toString(),
// });

/**
 * A base Bitcoin chain class that is extended by each Bitcoin chain/fork.
 */
export abstract class BitcoinBaseChain
    implements DepositChain<{ chain: string }, { chain: string }>
{
    public static chain = "Bitcoin";
    public name = BitcoinBaseChain.chain;

    public chainNetwork: BtcNetwork | undefined;

    // Asset
    public feeAsset = "BTC";

    // APIs
    public withDefaultAPIs = (network: BtcNetwork): this => {
        switch (network) {
            case "mainnet":
                // prettier-ignore
                return this
                    .withAPI(Blockstream())
                    .withAPI(Blockchair())
                    .withAPI(SoChain(), { priority: 15 });
            case "testnet":
                // prettier-ignore
                return this
                    .withAPI(Blockstream({ testnet: true }))
                    .withAPI(Blockchair(BlockchairNetwork.BITCOIN_TESTNET))
                    .withAPI(SoChain(SoChainNetwork.BTCTEST), { priority: 15 });
            case "regtest":
                // Will be supported when Electrum is added as an API.
                throw new Error(`Regtest is currently not supported.`);
        }
    };
    public api = CombinedAPI();
    public withAPI = (
        api: BitcoinAPI | APIWithPriority,
        { priority = 0 } = {},
    ) => {
        this.api.withAPI(api, { priority });
        return this;
    };

    // Utils
    public p2shPrefix = {} as { [network: string]: Buffer };

    public addressBufferToString = base58.encode as (bytes: Buffer) => string;
    public addressIsValid = (_address: string): boolean => true; // Implemented by each Bitcoin fork.

    public transactionIsValid = (_transaction: ChainTransaction): boolean =>
        true; // Implemented by each Bitcoin fork.

    public addressExplorerLink = (_address: string): string | undefined =>
        undefined; // Implemented by each Bitcoin fork.

    public transactionExplorerLink = (
        _tx: ChainTransaction,
    ): string | undefined => undefined; // Implemented by each Bitcoin fork.

    constructor(network: BtcNetwork) {
        this.chainNetwork = network;
        this.withDefaultAPIs(this.chainNetwork);
    }

    /**
     * See [[LockChain.assetIsNative]].
     */
    assetIsNative = (asset: string): boolean => asset === this.feeAsset;
    assetIsSupported = this.assetIsNative;

    isDepositAsset: (asset: string) => true;

    public readonly assertAssetIsSupported = (asset: string) => {
        if (!this.assetIsNative(asset)) {
            throw new Error(`Asset ${asset} not supported on ${this.name}.`);
        }
    };

    /**
     * See [[LockChain.assetDecimals]].
     */
    assetDecimals = (asset: string): number => {
        this.assertAssetIsSupported(asset);
        return 8;
    };

    /**
     * See [[LockChain.getDeposits]].
     */
    getDeposits = async (
        asset: string,
        address: string,
        progress: boolean | undefined,
        onDeposit: (deposit: BtcDeposit) => Promise<void>,
    ): Promise<boolean> => {
        if (!this.chainNetwork) {
            throw new Error(`${this.name} object not initialized`);
        }
        if (this.chainNetwork === "regtest") {
            throw new Error(`Unable to fetch deposits on ${this.chainNetwork}`);
        }
        this.assertAssetIsSupported(asset);

        let txs: UTXO[] | undefined;

        if (!progress) {
            try {
                txs = await retryNTimes(() => this.api.fetchTXs(address), 2);
            } catch (error) {
                // Ignore error and fallback to getUTXOs.
            }
        }

        if (!txs) {
            txs = await this.api.fetchUTXOs(address);
        }

        await Promise.all(
            txs.map(async (tx) => onDeposit(transactionToDeposit(tx))),
        );

        return true;
    };

    /**
     * See [[LockChain.transactionConfidence]].
     */
    transactionConfidence = async (
        transaction: BtcTransaction,
    ): Promise<{ current: number; target: number }> => {
        if (!this.chainNetwork) {
            throw new Error(`${this.name} object not initialized`);
        }
        transaction = await this.api.fetchUTXO(
            transaction.txHash,
            transaction.vOut,
        );
        return {
            current: transaction.confirmations,
            target: this.chainNetwork === "mainnet" ? 6 : 2,
        };
    };

    /**
     * See [[LockChain.getGatewayAddress]].
     */
    getGatewayAddress = (
        asset: string,
        publicKey: Buffer,
        gHash: Buffer,
    ): Promise<string> | string => {
        if (!this.chainNetwork) {
            throw new Error(`${this.name} object not initialized`);
        }
        this.assertAssetIsSupported(asset);
        const isTestnet = this.chainNetwork === "testnet";
        return this.utils.addressBufferToString(
            createAddressBuffer(
                hash160(publicKey),
                gHash,
                this.utils.p2shPrefix[isTestnet ? "testnet" : "mainnet"],
            ),
        );
    };

    /**
     * See [[LockChain.addressToBytes]].
     */
    addressToBytes = (address: string): Buffer => {
        try {
            return base58.decode(address);
        } catch (error) {
            try {
                const [type, ...words] = bech32.decode(address).words;
                return Buffer.concat([
                    Buffer.from([type]),
                    Buffer.from(bech32.fromWords(words)),
                ]);
            } catch (internalError) {
                throw new Error(`Unrecognized address format "${address}".`);
            }
        }
    };

    /**
     * See [[LockChain.bytesToAddress]].
     */
    bytesToAddress = (address: Buffer): string => {
        const words = bech32.toWords(address);
        return bech32.encode("", words);
    };

    /** @deprecated. Renamed to addressToBytes. */
    addressStringToBytes = this.addressToBytes;

    addressToString = (address: string) => address;

    /**
     * See [[LockChain.transactionID]].
     */
    transactionID = (transaction: BtcTransaction) => transaction.txHash;

    transactionIDFromRPCFormat = (
        txid: string | Buffer,
        _txindex: string,
        reversed?: boolean,
    ) => {
        // RenVM returns TXIDs in the correct byte direction, so they should be
        // reversed when converting to a string.
        // See https://learnmeabitcoin.com/technical/txid#why
        if (reversed) {
            // Reverse bytes.
            const bufferTxid =
                typeof txid === "string"
                    ? Buffer.from(strip0x(txid), "hex")
                    : // Create new buffer because `reverse` is in-place.
                      Buffer.from(txid);
            return bufferTxid.reverse().toString("hex");
        } else {
            return typeof txid === "string" ? txid : txid.toString("hex");
        }
    };

    transactionFromRPCFormat = async (
        txid: string | Buffer,
        txindex: string,
        reversed?: boolean,
    ) => {
        const txidString = this.transactionIDFromRPCFormat(
            txid,
            txindex,
            reversed,
        );
        return this.api.fetchUTXO(txidString, parseInt(txindex, 10));
    };
    /**
     * @deprecated Renamed to `transactionFromRPCFormat`.
     * Will be removed in 3.0.0.
     */
    transactionFromID = this.transactionFromRPCFormat;

    depositV1HashString = ({ transaction }: BtcDeposit): string => {
        return `${toBase64(fromHex(transaction.txHash))}_${transaction.vOut}`;
    };

    transactionRPCFormat = (transaction: BtcTransaction, v2?: boolean) => {
        const { txHash, vOut } = transaction;

        assertType<string>("string", { txHash });
        assertType<number>("number", { vOut });

        return {
            txid: v2
                ? fromHex(transaction.txHash).reverse()
                : fromHex(transaction.txHash),
            txindex: transaction.vOut.toFixed(),
        };
    };

    transactionRPCTxidFromID = (transactionID: string, v2?: boolean): Buffer =>
        v2 ? fromHex(transactionID).reverse() : fromHex(transactionID);

    // Methods for initializing mints and burns ////////////////////////////////

    private burnPayloadGetter: ((bytes?: boolean) => string) | undefined;

    /**
     * When burning, you can call `Bitcoin.Address("...")` to make the address
     * available to the burn params.
     *
     * @category Main
     */
    Address = (address: string): this => {
        // Type validation
        assertType<string>("string", { address });

        this.burnPayloadGetter = (bytes?: boolean) =>
            bytes ? this.addressToBytes(address).toString("hex") : address;

        return this;
    };

    burnPayload? = (burnPayloadConfig?: BurnPayloadConfig) => {
        return this.burnPayloadGetter
            ? this.burnPayloadGetter(
                  burnPayloadConfig && burnPayloadConfig.bytes,
              )
            : undefined;
    };

    toSats = (value: BigNumber | string | number): string =>
        new BigNumber(value)
            .times(new BigNumber(10).exponentiatedBy(8))
            .decimalPlaces(0)
            .toFixed();

    fromSats = (value: BigNumber | string | number): string =>
        new BigNumber(value)
            .dividedBy(new BigNumber(10).exponentiatedBy(8))
            .toFixed();
}

const _: ChainStatic<BtcTransaction, string, BtcNetwork> = BitcoinBaseChain;
