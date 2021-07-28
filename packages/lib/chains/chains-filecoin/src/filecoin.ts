import {
    decode as decodeAddress,
    encode as encodeAddress,
    validateAddressString,
} from "@glif/filecoin-address";
import {
    getRenNetworkDetails,
    LockAndMintParams,
    LockChain,
    ChainStatic,
    RenNetwork,
    RenNetworkDetails,
    RenNetworkString,
    BurnPayloadConfig,
} from "@renproject/interfaces";
import {
    assertType,
    Callable,
    SECONDS,
    sleep,
    toBase64,
    toURLBase64,
    utilsWithChainNetwork,
    isDefined,
    doesntError,
} from "@renproject/utils";
import { blake2b } from "blakejs";
import CID from "cids";
import elliptic from "elliptic";
import FilecoinClient from "@glif/filecoin-rpc-client";

import { FilNetwork as FilNetworkImport, FilTransaction } from "./deposit";
import { fetchDeposits, fetchMessage } from "./api/lotus";
import { Filfox } from "./api/explorers/filfox";

export type FilNetwork = FilNetworkImport;

export type FilAddress = {
    address: string; // Filecoin address
    params?: string; // base64
};
export type FilDeposit = {
    transaction: FilTransaction;
    amount: string;
};

const NETWORK_NOT_SUPPORTED = `Filecoin is not supported by the current RenVM network.`;

const transactionToDeposit = (transaction: FilTransaction) => ({
    transaction,
    amount: transaction.amount.toString(),
});

interface ConstructorOptions {
    apiAddress?: string;
    token?: string;
    useParams?: boolean;
}

export class FilecoinClass
    implements
        LockChain<FilTransaction, FilDeposit, FilAddress, FilNetwork, number>
{
    public static chain = "Filecoin";
    public chain = FilecoinClass.chain;
    public name = FilecoinClass.chain;

    public renNetwork: RenNetworkDetails | undefined;
    public chainNetwork: FilNetwork | undefined;

    public asset = "FIL";

    public client: FilecoinClient | undefined;

    public clientOptions: ConstructorOptions;

    public noParamsFlag: boolean | undefined;
    public filfox: Filfox | undefined;

    public static utils = {
        resolveChainNetwork: (
            network:
                | RenNetwork
                | RenNetworkString
                | RenNetworkDetails
                | FilNetwork,
        ): FilNetwork => {
            if (
                network === "mainnet" ||
                network === "testnet" ||
                network === "devnet"
            ) {
                return network;
            }

            const renNetwork = getRenNetworkDetails(network);
            return renNetwork.isTestnet ? "testnet" : "mainnet";
        },
        addressIsValid: (
            address: FilAddress | string,
            _network:
                | RenNetwork
                | RenNetworkString
                | RenNetworkDetails
                | FilNetwork = "mainnet",
        ) =>
            validateAddressString(
                typeof address === "string" ? address : address.address,
            ),

        transactionIsValid: doesntError(
            (
                transaction: FilTransaction | string,
                _network:
                    | RenNetwork
                    | RenNetworkString
                    | RenNetworkDetails
                    | FilNetwork = "mainnet",
            ) => {
                const transactionString =
                    typeof transaction === "string"
                        ? transaction
                        : transaction.cid;
                const cid = new CID(transactionString);
                return (
                    transactionString === cid.toString() &&
                    cid.bytes.length === 38
                );
            },
        ),

        addressExplorerLink: (
            address: FilAddress | string,
            _network:
                | RenNetwork
                | RenNetworkString
                | RenNetworkDetails
                | FilNetwork = "mainnet",
        ): string => {
            // TODO: Check network.
            return `https://filfox.info/en/address/${
                typeof address === "string" ? address : address.address
            }`;
        },

        transactionExplorerLink: (
            transaction: FilTransaction | string,
            _network:
                | RenNetwork
                | RenNetworkString
                | RenNetworkDetails
                | FilNetwork = "mainnet",
        ): string => {
            // TODO: Check network.
            return `https://filfox.info/en/message/${
                typeof transaction === "string" ? transaction : transaction.cid
            }`;
        },
    };

    public utils = utilsWithChainNetwork<
        typeof FilecoinClass["utils"],
        FilTransaction,
        FilAddress,
        FilNetwork
    >(FilecoinClass.utils, () => this.chainNetwork);

    constructor(
        network?: FilNetwork,
        { useParams, ...options }: ConstructorOptions = {},
    ) {
        this.chainNetwork = network;
        this.clientOptions = options;
        this.noParamsFlag = !useParams;
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

        this.client = new FilecoinClient({
            apiAddress: isDefined(this.clientOptions.apiAddress)
                ? this.clientOptions.apiAddress
                : `https://lotus-cors-proxy.herokuapp.com/${this.chainNetwork}`,
            token: this.clientOptions.token,
        });

        if (this.chainNetwork === "mainnet") {
            this.filfox = new Filfox(this.chainNetwork);
        }

        return this;
    };

    /**
     * See [[LockChain.assetIsNative]].
     */
    assetIsNative = (asset: string): boolean => asset === this.asset;
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
        if (asset === this.asset) {
            return 18;
        }
        throw new Error(`Asset ${asset} not supported on ${this.chain}.`);
    };

    /**
     * See [[LockChain.getDeposits]].
     */
    getDeposits = async (
        asset: string,
        address: FilAddress,
        progress: number | undefined,
        onDeposit: (deposit: FilDeposit) => Promise<void>,
    ): Promise<number> => {
        if (!this.chainNetwork) {
            throw new Error(`${this.name} object not initialized.`);
        }
        if (this.chainNetwork === "devnet") {
            throw new Error(
                `Unable to fetch deposits on ${this.chainNetwork}.`,
            );
        }
        this.assertAssetIsSupported(asset);

        // For the first time `getDeposits` is called, fetch transactions from
        // explorer API. (mainnet only)
        if (this.filfox && (!progress || progress === 0)) {
            try {
                const size = 100;
                let page = 0;

                while (true) {
                    const { deposits, totalCount } =
                        await this.filfox.fetchDeposits(
                            address.address,
                            address.params,
                            page,
                            size,
                        );

                    await Promise.all(
                        (deposits || []).map(async (tx) =>
                            onDeposit(transactionToDeposit(tx)),
                        ),
                    );

                    if (size * (page + 1) >= totalCount) {
                        break;
                    }

                    page += 1;

                    await sleep(10 * SECONDS);
                }
            } catch (error) {
                // Ignore error.
            }
        }

        let txs: FilTransaction[];
        ({ txs, progress } = await fetchDeposits(
            this.client,
            address.address,
            address.params,
            this.chainNetwork,
            progress || 0,
        ));

        await Promise.all(
            (txs || []).map(async (tx) => onDeposit(transactionToDeposit(tx))),
        );

        return progress;
    };

    /**
     * See [[LockChain.transactionConfidence]].
     */
    transactionConfidence = async (
        transaction: FilTransaction,
    ): Promise<{ current: number; target: number }> => {
        if (!this.chainNetwork) {
            throw new Error(`${this.name} object not initialized.`);
        }
        transaction = await fetchMessage(
            this.client,
            transaction.cid,
            this.chainNetwork,
        );
        return {
            current: transaction.confirmations,
            target: this.chainNetwork === "mainnet" ? 12 : 6, // NOT FINAL VALUES
        };
    };

    /**
     * See [[LockChain.getGatewayAddress]].
     */
    getGatewayAddress = (
        asset: string,
        compressedPublicKey: Buffer,
        gHash: Buffer,
    ): Promise<FilAddress> | FilAddress => {
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
        const derivedPublicKey = this.noParamsFlag
            ? ec.keyFromPublic(
                  renVMPublicKey
                      .getPublic()
                      .add(
                          gHashKey.getPublic(),
                      ) as unknown as elliptic.ec.KeyPair,
              )
            : renVMPublicKey;

        const payload = Buffer.from(
            blake2b(
                Buffer.from(derivedPublicKey.getPublic(false, "hex"), "hex"),
                null,
                20,
            ),
        );

        const address = this.encodeFilecoinAddress(payload);

        const params = this.noParamsFlag
            ? undefined
            : toBase64(Buffer.from(toURLBase64(gHash)));

        return {
            address,
            params,
        };
    };

    encodeFilecoinAddress = (payload: Buffer) => {
        if (payload.length === 21) {
            payload = Buffer.from(payload.slice(1, 21));
        }
        // secp256k1 protocol prefix
        const protocol = 1;
        // network prefix
        const networkPrefix = this.chainNetwork === "testnet" ? "t" : "f";

        const addressObject = {
            str: Buffer.concat([Buffer.from([protocol]), payload]),
            protocol: () => protocol,
            payload: () => payload,
        };

        return encodeAddress(networkPrefix, addressObject);
    };

    /**
     * See [[LockChain.addressToBytes]].
     */
    addressToBytes = (address: FilAddress | string): Buffer =>
        Buffer.from(
            decodeAddress(
                typeof address === "string" ? address : address.address,
            ).str,
        );

    /**
     * See [[LockChain.addressToBytes]].
     */
    bytesToAddress = (address: Buffer): string =>
        this.encodeFilecoinAddress(address);

    /** @deprecated. Renamed to addressToBytes. */
    addressStringToBytes = this.addressToBytes;

    addressToString = (address: FilAddress | string): string =>
        typeof address === "string" ? address : address.address;

    /**
     * See [[LockChain.transactionID]].
     */
    transactionID = (transaction: FilTransaction): string => transaction.cid;

    transactionIDFromRPCFormat = (
        txid: string | Buffer,
        _txindex: string,
    ): string => (typeof txid === "string" ? txid : new CID(txid).toString());

    transactionFromRPCFormat = async (
        txid: string | Buffer,
        _txindex: string,
    ): Promise<FilTransaction> => {
        if (!this.chainNetwork) {
            throw new Error(`${this.name} object not initialized.`);
        }
        return fetchMessage(
            this.client,
            typeof txid === "string" ? txid : new CID(txid).toString(),
            this.chainNetwork,
        );
    };
    /**
     * @deprecated Renamed to `transactionFromRPCFormat`.
     * Will be removed in 3.0.0.
     */
    transactionFromID = this.transactionFromRPCFormat;

    depositV1HashString = (_deposit: FilDeposit): string => {
        throw new Error(NETWORK_NOT_SUPPORTED);
    };

    transactionRPCFormat = (transaction: FilTransaction, v2?: boolean) => {
        if (!v2) {
            throw new Error(NETWORK_NOT_SUPPORTED);
        }

        return {
            txid: Buffer.from(new CID(transaction.cid).bytes),
            txindex: transaction.nonce.toFixed(),
        };
    };

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

    burnPayload? = (config?: BurnPayloadConfig) => {
        return this.getBurnPayload
            ? this.getBurnPayload(config?.bytes)
            : undefined;
    };
}

export type Filecoin = FilecoinClass;
// @dev Removes any static fields, except `utils`.
export const Filecoin = Callable(FilecoinClass);

const _: ChainStatic<FilTransaction, FilAddress, FilNetwork> = Filecoin;
const __: LockAndMintParams["from"] = Filecoin();
