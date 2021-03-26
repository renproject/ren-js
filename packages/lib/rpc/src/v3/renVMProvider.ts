import {
    BurnAndReleaseTransaction,
    getRenNetworkDetails,
    LockAndMintTransaction,
    LockChain,
    Logger,
    MintChain,
    NullLogger,
    RenNetwork,
    RenNetworkDetails,
    RenNetworkString,
    TxStatus,
} from "@renproject/interfaces";
import { HttpProvider, Provider } from "@renproject/provider";
import {
    assertType,
    fromBase64,
    isDefined,
    SECONDS,
    sleep,
    toURLBase64,
} from "@renproject/utils";
import BigNumber from "bignumber.js";

import { AbstractRenVMProvider } from "../abstract";
import {
    ParamsQueryBlock,
    ParamsQueryBlocks,
    ParamsQueryTx,
    ParamsQueryTxs,
    ParamsSubmitBurn,
    ParamsSubmitMint,
    RenVMParams,
    RenVMResponses,
    RPCMethod,
} from "./methods";
import {
    hashTransaction,
    mintParamsType,
    MintTransactionInput,
} from "./transaction";
import { unmarshalBurnTx, unmarshalMintTx } from "./unmarshal";

export const resolveV2Contract = ({
    asset,
    from,
    to,
}: {
    asset: string;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    from: LockChain<any, any, any> | MintChain<any, any>;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    to: LockChain<any, any, any> | MintChain<any, any>;
}): string => {
    if (
        (from as LockChain).assetIsNative &&
        (from as LockChain).assetIsNative(asset)
    ) {
        return `${asset}/to${to.name}`;
    }
    if (
        (to as LockChain).assetIsNative &&
        (to as LockChain).assetIsNative(asset)
    ) {
        return `${asset}/from${from.name}`;
    }
    return `${asset}/from${from.name}To${to.name}`;
};

export class RenVMProvider
    implements AbstractRenVMProvider<RenVMParams, RenVMResponses> {
    public version = () => 3;

    private readonly network: RenNetwork;

    public readonly provider: Provider<RenVMParams, RenVMResponses>;
    sendMessage: RenVMProvider["provider"]["sendMessage"];
    private readonly logger: Logger;

    constructor(
        network: RenNetwork | RenNetworkString | RenNetworkDetails,
        provider?: Provider<RenVMParams, RenVMResponses> | string,
        logger: Logger = NullLogger,
    ) {
        if (!provider || typeof provider === "string") {
            const rpcUrl =
                provider || (getRenNetworkDetails(network) || {}).lightnode;
            try {
                provider = new HttpProvider<RenVMParams, RenVMResponses>(
                    rpcUrl,
                    logger,
                );
            } catch (error) {
                if (/Invalid node URL/.exec(String(error && error.message))) {
                    throw new Error(
                        `Invalid network or provider URL: "${
                            (getRenNetworkDetails(network) || {}).name ||
                            String(network)
                        }"`,
                    );
                }
                throw error;
            }
        }

        this.network = network as RenNetwork;
        this.logger = logger;
        this.provider = provider;
        this.sendMessage = this.provider.sendMessage;
    }

    public selector = (params: {
        asset: string;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        from: LockChain<any, any, any> | MintChain<any, any>;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        to: LockChain<any, any, any> | MintChain<any, any>;
    }): string => {
        return resolveV2Contract(params);
    };

    public queryBlock = async (
        blockHeight: ParamsQueryBlock["blockHeight"],
        retry?: number,
    ) =>
        this.sendMessage<RPCMethod.QueryBlock>(
            RPCMethod.QueryBlock,
            { blockHeight },
            retry,
        );

    public queryBlocks = async (
        blockHeight: ParamsQueryBlocks["blockHeight"],
        n: ParamsQueryBlocks["n"],
        retry?: number,
    ) =>
        this.sendMessage<RPCMethod.QueryBlocks>(
            RPCMethod.QueryBlocks,
            { blockHeight, n },
            retry,
        );

    public submitTx = async (
        tx: ParamsSubmitBurn["tx"] | ParamsSubmitMint["tx"],
        retry?: number,
    ) =>
        this.sendMessage<RPCMethod.SubmitTx>(
            RPCMethod.SubmitTx,
            { tx } as ParamsSubmitBurn | ParamsSubmitMint,
            retry,
        );

    public queryTx = async (txHash: ParamsQueryTx["txHash"], retry?: number) =>
        this.sendMessage<RPCMethod.QueryTx>(
            RPCMethod.QueryTx,
            { txHash },
            retry,
        );

    public queryTxs = async (
        tags: ParamsQueryTxs["tags"],
        page?: number,
        pageSize?: number,
        txStatus?: ParamsQueryTxs["txStatus"],
        retry?: number,
    ) =>
        this.sendMessage<RPCMethod.QueryTxs>(
            RPCMethod.QueryTxs,
            {
                tags,
                page: (page || 0).toString(),
                pageSize: (pageSize || 0).toString(),
                txStatus,
            },
            retry,
        );

    public queryConfig = async (retry?: number) =>
        this.sendMessage<RPCMethod.QueryConfig>(
            RPCMethod.QueryConfig,
            {},
            retry,
        );

    public queryState = async (retry?: number) =>
        this.sendMessage<RPCMethod.QueryBlockState>(
            RPCMethod.QueryBlockState,
            {},
            retry,
        );

    public buildTransaction = ({
        selector,
        gHash,
        gPubKey,
        nHash,
        nonce,
        output,
        amount,
        payload,
        pHash,
        to,
    }: {
        selector: string;
        gHash: Buffer;
        gPubKey: Buffer;
        nHash: Buffer;
        nonce: Buffer;
        output: { txid: Buffer; txindex: string };
        amount: string;
        payload: Buffer;
        pHash: Buffer;
        to: string;
    }): MintTransactionInput => {
        assertType<Buffer>("Buffer", {
            gHash,
            gPubKey,
            nHash,
            nonce,
            payload,
            pHash,
            txid: output.txid,
        });
        assertType<string>("string", { to, amount, txindex: output.txindex });
        const version = "1";
        const txIn = {
            t: mintParamsType(),
            v: {
                txid: toURLBase64(output.txid),
                txindex: output.txindex,
                ghash: toURLBase64(gHash),
                gpubkey: toURLBase64(gPubKey),
                nhash: toURLBase64(nHash),
                nonce: toURLBase64(nonce),
                payload: toURLBase64(payload),
                phash: toURLBase64(pHash),
                to,
                amount,
            },
        };
        return {
            hash: toURLBase64(hashTransaction(version, selector, txIn)),
            selector: selector,
            version,
            // TODO: Fix types
            in: (txIn as unknown) as MintTransactionInput["in"],
        };
    };

    public mintTxHash = (params: {
        selector: string;
        gHash: Buffer;
        gPubKey: Buffer;
        nHash: Buffer;
        nonce: Buffer;
        output: { txindex: string; txid: Buffer };
        amount: string;
        payload: Buffer;
        pHash: Buffer;
        to: string;
    }): Buffer => {
        return fromBase64(this.buildTransaction(params).hash);
    };

    public submitMint = async (params: {
        selector: string;
        gHash: Buffer;
        gPubKey: Buffer;
        nHash: Buffer;
        nonce: Buffer;
        output: { txindex: string; txid: Buffer };
        amount: string;
        payload: Buffer;
        pHash: Buffer;
        to: string;
    }): Promise<Buffer> => {
        const tx = this.buildTransaction(params);
        await this.submitTx(tx);
        return fromBase64(tx.hash);
    };

    public burnTxHash = this.mintTxHash;
    public submitBurn = this.submitMint;

    /**
     * Queries the result of a RenVM transaction and unmarshals the result into
     * a [[LockAndMintTransaction]] or [[BurnAndReleaseTransaction]].
     *
     * @param renVMTxHash The transaction hash as a Buffer.
     */
    public readonly queryMintOrBurn = async <
        T extends LockAndMintTransaction | BurnAndReleaseTransaction
    >(
        _selector: string,
        renVMTxHash: Buffer,
    ): Promise<T> => {
        try {
            const response = await this.queryTx(toURLBase64(renVMTxHash));

            // Unmarshal transaction.
            // TODO: Improve mint/burn detection. Currently checks if the format
            // is `ASSET/toChain` or `ASSET/fromChainToChain`. It may return
            // a false positive if the chain name contains `To`.
            const isMint = /((\/to)|(To))/.exec(response.tx.selector);

            if (isMint) {
                return unmarshalMintTx(response) as T;
            } else {
                return unmarshalBurnTx(response) as T;
            }
        } catch (error) {
            throw error;
        }
    };

    /**
     * Fetches the result of a RenVM transaction on a repeated basis until the
     * transaction's status is `"done"`.
     *
     * @param utxoTxHash The transaction hash as a Buffer.
     * @param onStatus A callback called each time the status of the transaction
     * is refreshed - even if it hasn't changed.
     * @param _cancelRequested A function that returns `true` to cancel the
     * loop.
     */
    public readonly waitForTX = async <
        T extends LockAndMintTransaction | BurnAndReleaseTransaction
    >(
        selector: string,
        utxoTxHash: Buffer,
        onStatus?: (status: TxStatus) => void,
        _cancelRequested?: () => boolean,
        timeout?: number,
    ): Promise<T> => {
        assertType<Buffer>("Buffer", { utxoTxHash });
        let rawResponse: T;
        while (true) {
            if (_cancelRequested && _cancelRequested()) {
                throw new Error(`waitForTX cancelled.`);
            }

            try {
                const result = await this.queryMintOrBurn<T>(
                    selector,
                    utxoTxHash,
                );
                if (result && result.txStatus === TxStatus.TxStatusDone) {
                    rawResponse = result;
                    break;
                } else if (onStatus && result && result.txStatus) {
                    onStatus(result.txStatus);
                }
            } catch (error) {
                if (
                    /(not found)|(not available)/.exec(
                        String((error || {}).message),
                    )
                ) {
                    // ignore
                } else {
                    this.logger.error(String(error));
                    // TODO: throw unexpected errors
                }
            }
            await sleep(isDefined(timeout) ? timeout : 15 * SECONDS);
        }
        return rawResponse;
    };

    /**
     * selectPublicKey fetches the public key for the RenVM shard handling
     * the provided contract.
     *
     * @param chain The chain for which the public key should be fetched.
     * @returns The public key hash (20 bytes) as a string.
     */
    public readonly selectPublicKey = async (
        _selector: string,
        asset: string,
    ): Promise<Buffer> => {
        // Call the ren_queryShards RPC.
        const response = await this.queryState(5);
        return fromBase64(response.state.v[asset].shards[0].pubKey);
    };

    // In the future, this will be asynchronous. It returns a promise for
    // compatibility.
    // eslint-disable-next-line @typescript-eslint/require-await
    public getNetwork = async (_selector: string): Promise<RenNetwork> => {
        return this.network;
    };

    public getConfirmationTarget = async (
        _selector: string,
        chain: { name: string },
    ) => {
        const renVMConfig = await this.sendMessage(RPCMethod.QueryConfig, {});
        return parseInt(renVMConfig.confirmations[chain.name], 10);
    };

    public estimateTransactionFee = async (
        _selector: string,
        chain: { name: string },
    ): Promise<{ lock: BigNumber; release: BigNumber }> => {
        const renVMState = await this.sendMessage(
            RPCMethod.QueryBlockState,
            {},
        );

        if (!renVMState.state[chain.name]) {
            throw new Error(`No fee details found for ${chain.name}`);
        }

        const { gasLimit, gasCap } = renVMState.state[chain.name];
        const fee = new BigNumber(gasLimit).times(new BigNumber(gasCap));

        return {
            lock: fee,
            release: fee,
        };
    };
}
