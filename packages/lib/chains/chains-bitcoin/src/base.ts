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
    fromHex,
    hash160,
    retryNTimes,
    strip0x,
    toBase64,
    utilsWithChainNetwork,
} from "@renproject/utils";
import BigNumber from "bignumber.js";
import { Networks, Opcode, Script } from "bitcore-lib";
import base58 from "bs58";
import { APIWithPriority, BitcoinAPI, CombinedAPI, UTXO } from "./APIs/API";
import { Blockchair, BlockchairNetwork } from "./APIs/blockchair";
import { Blockstream } from "./APIs/blockstream";
import { SoChain, SoChainNetwork } from "./APIs/sochain";

import { createAddress, pubKeyScript as calculatePubKeyScript } from "./script";

export type BtcAddress = string;
export type BtcTransaction = UTXO;
export type BtcDeposit = {
    transaction: BtcTransaction;
    amount: string;
};
export type BtcNetwork = "mainnet" | "testnet" | "regtest";

const transactionToDeposit = (transaction: BtcTransaction) => ({
    transaction,
    amount: transaction.amount.toString(),
});

/**
 * A base Bitcoin chain class that is extended by each Bitcoin chain/fork.
 */
export abstract class BitcoinBaseChain
    implements
        LockChain<BtcTransaction, BtcDeposit, BtcAddress, BtcNetwork, boolean> {
    public static chain = "Bitcoin";
    public chain = BitcoinBaseChain.chain;
    public name = BitcoinBaseChain.chain;

    public legacyName: LockChain["legacyName"] = "Btc";
    public renNetwork: RenNetworkDetails | undefined;
    public chainNetwork: BtcNetwork | undefined;

    // Asset
    public static asset = "BTC";
    public asset = "BTC";

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
    public static utils = {
        p2shPrefix: {} as { [network: string]: Buffer },
        createAddress: createAddress(base58.encode, Networks, Opcode, Script),
        calculatePubKeyScript: calculatePubKeyScript(Networks, Opcode, Script),
        addressIsValid: (
            _address: BtcAddress | string,
            _network:
                | RenNetwork
                | RenNetworkString
                | RenNetworkDetails
                | BtcNetwork = "mainnet",
        ): boolean => true,

        addressExplorerLink: (
            _address: BtcAddress | string,
            _network:
                | RenNetwork
                | RenNetworkString
                | RenNetworkDetails
                | BtcNetwork = "mainnet",
        ): string | undefined => undefined,

        transactionExplorerLink: (
            _tx: BtcTransaction | string,
            _network:
                | RenNetwork
                | RenNetworkString
                | RenNetworkDetails
                | BtcNetwork = "mainnet",
        ): string | undefined => undefined,

        resolveChainNetwork: (
            network:
                | RenNetwork
                | RenNetworkString
                | RenNetworkDetails
                | BtcNetwork,
        ): BtcNetwork => {
            if (
                network === "mainnet" ||
                network === "testnet" ||
                network === "regtest"
            ) {
                return network;
            }

            const renNetwork = getRenNetworkDetails(network);
            return renNetwork.isTestnet ? "testnet" : "mainnet";
        },
    };

    public utils = utilsWithChainNetwork(
        BitcoinBaseChain.utils,
        () => this.chainNetwork,
    );

    constructor(network?: BtcNetwork) {
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
            this.chainNetwork ||
            (this.renNetwork.isTestnet ? "testnet" : "mainnet");
        return this.withDefaultAPIs(this.chainNetwork);
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
            return 8;
        }
        throw new Error(`Unsupported asset ${asset}`);
    };

    /**
     * See [[LockChain.getDeposits]].
     */
    getDeposits = async (
        asset: string,
        address: BtcAddress,
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
    ): Promise<BtcAddress> | BtcAddress => {
        if (!this.chainNetwork) {
            throw new Error(`${this.name} object not initialized`);
        }
        this.assertAssetIsSupported(asset);
        const isTestnet = this.chainNetwork === "testnet";
        return this.utils.createAddress(
            isTestnet,
            hash160(publicKey),
            gHash,
            this.utils.p2shPrefix[isTestnet ? "testnet" : "mainnet"],
        );
    };

    /**
     * See [[LockChain.addressStringToBytes]].
     */
    addressStringToBytes = (address: string): Buffer => {
        return base58.decode(address);
    };

    /**
     * See [[LockChain.transactionID]].
     */
    transactionID = (transaction: BtcTransaction) => transaction.txHash;

    transactionFromID = (
        txid: string | Buffer,
        txindex: string,
        reversed?: boolean,
    ) => {
        let txidString;

        // RenVM returns TXIDs in the correct byte direction, so they should be
        // reversed when converting to a string.
        // See https://learnmeabitcoin.com/technical/txid#why
        if (reversed) {
            // Reverse bytes.
            const bufferTxid =
                typeof txid === "string"
                    ? Buffer.from(strip0x(txid), "hex")
                    : txid;
            txidString = bufferTxid.reverse().toString("hex");
        } else {
            txidString = typeof txid === "string" ? txid : txid.toString("hex");
        }

        return this.api.fetchUTXO(txidString, parseInt(txindex, 10));
    };

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

    // Methods for initializing mints and burns ////////////////////////////////

    getBurnPayload: (() => string) | undefined;

    /**
     * When burning, you can call `Bitcoin.Address("...")` to make the address
     * available to the burn params.
     *
     * @category Main
     */
    Address = (address: string): this => {
        // Type validation
        assertType<string>("string", { address });

        this.getBurnPayload = () => address;
        return this;
    };

    burnPayload? = () => {
        return this.getBurnPayload ? this.getBurnPayload() : undefined;
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

const _: ChainStatic<BtcTransaction, BtcAddress, BtcNetwork> = BitcoinBaseChain;
