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
    RenNetwork,
    utils,
} from "@renproject/utils";
import { AccAddress, SimplePublicKey } from "@terra-money/terra.js";
import { bech32 } from "bech32";
import BigNumber from "bignumber.js";
import elliptic from "elliptic";

import { TerraDev } from "./api/terraDev";
import { isTerraNetworkConfig, TerraNetworkConfig } from "./api/types";
import { txHashFromBytes, txHashToBytes } from "./utils";

export const TerraMainnet: TerraNetworkConfig = {
    selector: "Terra",
    chainId: "columbus-5",
    addressPrefix: "terra",

    nativeAsset: {
        name: "Luna",
        symbol: "LUNA",
        decimals: 6,
    },
    averageConfirmationTime: 6,

    explorer: "https://finder.terra.money/mainnet",
    apiUrl: "https://fcd.terra.dev",
};

export const TerraTestnet: TerraNetworkConfig = {
    selector: "Terra",
    chainId: "bombay-12",
    addressPrefix: "terra",
    isTestnet: true,

    nativeAsset: {
        name: "Luna",
        symbol: "LUNA",
        decimals: 6,
    },
    averageConfirmationTime: 6,

    explorer: "https://finder.terra.money/testnet",
    apiUrl: "https://bombay-fcd.terra.dev",
};

export const TerraConfigMap = {
    [RenNetwork.Mainnet]: TerraMainnet,
    [RenNetwork.Testnet]: TerraTestnet,
};

export type TerraInputPayload =
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

export interface TerraOutputPayload {
    chain: string;
    type?: "address";
    params: {
        address: string;
    };
}

/**
 * Terra implements the LockChain interface for Terra (https://terra.money)
 * and it's asset LUNA.
 */
export class Terra
    implements DepositChain<TerraInputPayload, TerraOutputPayload>
{
    public static chain = "Terra" as const;
    public chain: string;

    public static configMap = TerraConfigMap;
    public configMap = TerraConfigMap;

    public network: TerraNetworkConfig;

    public api: TerraDev;

    // The assets native to Terra.
    public static assets = {
        [RenNetwork.Mainnet]: { LUNA: "LUNA" as const },
        [RenNetwork.Testnet]: { LUNA: "LUNA" as const },
    };
    public assets:
        | typeof Terra.assets[RenNetwork.Mainnet]
        | typeof Terra.assets[RenNetwork.Testnet];

    public validateAddress = (address: string): boolean => {
        assertType<string>("string", { address: address });
        return AccAddress.validate(address);
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
                      uppercase: true,
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
                ? utils.toURLBase64(this.txHashToBytes(transaction.txHash)) ===
                  transaction.txid
                : true)
        );
    };

    public addressExplorerLink = (address: string): string => {
        return new URL(`/account/${address}`, /* base */ this.network.explorer)
            .href;
    };

    public transactionExplorerLink = ({
        txid,
        txHash,
    }: Partial<ChainTransaction> & ({ txid: string } | { txHash: string })):
        | string
        | undefined => {
        const hash =
            txHash || (txid && this.txHashFromBytes(utils.fromBase64(txid)));
        return hash
            ? new URL(`/tx/${String(hash)}`, /* base */ this.network.explorer)
                  .href
            : undefined;
    };

    public addressToBytes = (address: string): Uint8Array => {
        return new Uint8Array(bech32.fromWords(bech32.decode(address).words));
    };

    public addressFromBytes = (bytes: Uint8Array): string => {
        return bech32.encode(this.network.addressPrefix, bech32.toWords(bytes));
    };

    public txHashToBytes = (txHash: string): Uint8Array => {
        return txHashToBytes(txHash);
    };

    public txHashFromBytes = (bytes: Uint8Array): string => {
        return txHashFromBytes(bytes);
    };

    public constructor({
        network,
    }: {
        network: RenNetwork | `${RenNetwork}` | TerraNetworkConfig;
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
        this.assets =
            Terra.assets[
                this.network.isTestnet ? RenNetwork.Testnet : RenNetwork.Mainnet
            ];
    }

    public isLockAsset = (asset: string): boolean => {
        return this.assets[asset] !== undefined;
    };

    /**
     * See [[LockChain.isLockAsset]].
     */
    public isDepositAsset = (asset: string): boolean => {
        return this.isLockAsset(asset);
    };

    private _assertAssetIsSupported = (asset: string) => {
        if (!this.isLockAsset(asset)) {
            throw new Error(`Unsupported asset ${asset}.`);
        }
    };

    /**
     * See [[LockChain.assetDecimals]].
     */
    public assetDecimals = (asset: string): number => {
        switch (asset) {
            case this.assets.LUNA:
                return 6;
        }
        throw new Error(`Unsupported asset ${String(asset)}.`);
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

    /**
     * See [[LockChain.getDeposits]].
     */
    public watchForDeposits = async (
        asset: string,
        fromPayload: TerraInputPayload,
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

        while (true) {
            if (listenerCancelled()) {
                return;
            }
            const txs = await this.api.fetchDeposits(address);

            txs.map((tx) =>
                onInput({
                    chain: this.chain,
                    txid: utils.toURLBase64(txHashToBytes(tx.hash)),
                    txindex: "0",
                    txHash: tx.hash.toUpperCase(),
                    explorerLink:
                        this.transactionExplorerLink({
                            txHash: tx.hash.toUpperCase(),
                        }) || "", // TODO

                    asset,
                    amount: tx.amount,
                }),
            );

            await utils.sleep(15 * utils.sleep.SECONDS);
        }
    };

    /**
     * See [[LockChain.transactionConfidence]].
     */
    public transactionConfidence = async (
        transaction: ChainTransaction,
    ): Promise<BigNumber> => {
        if (!this.network) {
            throw new Error(`${this.chain} object not initialized.`);
        }
        return await this.api.fetchConfirmations(transaction.txHash);
    };

    /**
     * See [[LockChain.getGatewayAddress]].
     */
    public createGatewayAddress = (
        asset: string,
        fromPayload: TerraInputPayload,
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

        // 33-byte compressed public key.
        const newCompressedPublicKey: Uint8Array = new Uint8Array(
            derivedPublicKey.getPublic().encodeCompressed(),
        );

        // Create Terra key from compressed public key, to calculate address.
        const key = new SimplePublicKey(utils.toBase64(newCompressedPublicKey));

        return key.address();
    };

    public getOutputPayload = (
        asset: string,
        _inputType: InputType,
        _outputType: OutputType,
        toPayload: TerraOutputPayload,
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
            toBytes: new Uint8Array(
                bech32.fromWords(bech32.decode(address).words),
            ),
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
            explorerLink: this.transactionExplorerLink,
        });
    };

    // Methods for initializing mints and burns ////////////////////////////////

    /**
     * When burning, you can call `Terra.Address("...")` to make the address
     * available to the burn params.
     *
     * @category Main
     */
    public Address = (address: string): TerraOutputPayload => {
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
     * When burning, you can call `Terra.Address("...")` to make the address
     * available to the burn params.
     *
     * @category Main
     */
    public GatewayAddress = (): TerraInputPayload => {
        return {
            chain: this.chain,
            type: "gatewayAddress",
        };
    };

    /**
     * Import an existing Terra transaction instead of watching for deposits
     * to a gateway address.
     *
     * @example
     * terra.Transaction({
     *   txHash: "A16B0B3E...",
     *   txindex: "0",
     * })
     */
    public Transaction = (
        partialTx: Partial<ChainTransaction> &
            ({ txid: string } | { txHash: string }),
    ): TerraInputPayload => {
        return {
            chain: this.chain,
            type: "transaction",
            params: {
                tx: this.populateChainTransaction(partialTx),
            },
        };
    };
}
