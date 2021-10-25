import {
    assertType,
    fromBase64,
    isDefined,
    Logger,
    NullLogger,
    RenNetwork,
    RenNetworkString,
    renRpcUrls,
    SECONDS,
    sleep,
    toURLBase64,
    TxStatus,
} from "@renproject/utils";

import { BlockState } from "./methods/ren_queryBlockState";
import { unmarshalTypedPackValue } from "./pack/pack";
import { HttpProvider } from "./rpc/jsonRpc";
import {
    ParamsQueryBlock,
    ParamsQueryBlocks,
    ParamsQueryTx,
    ParamsQueryTxs,
    ParamsSubmitBurn,
    ParamsSubmitGateway,
    ParamsSubmitMint,
    RenVMParams,
    RenVMResponses,
    RPCMethod,
} from "./rpc/methods";
import {
    hashTransaction,
    mintParamsType,
    MintTransactionInput,
    SubmitGatewayInput,
    submitGatewayType,
} from "./transaction";
import {
    CrossChainTxResponse,
    TxResponseWithStatus,
    unmarshalCrossChainTxResponse,
} from "./unmarshal";

export class RenVMProvider extends HttpProvider<RenVMParams, RenVMResponses> {
    public readonly logger: Logger;

    constructor(
        rpcUrlOrNetwork: RenNetwork | RenNetworkString | string,
        logger: Logger = NullLogger,
    ) {
        super(renRpcUrls[rpcUrlOrNetwork] || rpcUrlOrNetwork);
        this.logger = logger;
    }

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

    public submitGateway = async (
        gateway: ParamsSubmitGateway["gateway"],
        tx: ParamsSubmitGateway["tx"],
        retry?: number,
    ) =>
        this.sendMessage<RPCMethod.SubmitGateway>(
            RPCMethod.SubmitGateway,
            { gateway, tx },
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

    /**
     * @deprecated - use `queryBlockState` instead.
     */
    public queryState = async (retry?: number) =>
        this.sendMessage<RPCMethod.QueryState>(RPCMethod.QueryState, {}, retry);

    public queryBlockState = async (retry?: number) =>
        this.sendMessage<RPCMethod.QueryBlockState>(
            RPCMethod.QueryBlockState,
            {},
            retry,
        );

    public buildGateway = ({
        selector,
        gHash,
        gPubKey,
        nHash,
        nonce,
        payload,
        pHash,
        to,
    }: {
        selector: string;
        gHash: Buffer;
        gPubKey: Buffer;
        nHash: Buffer;
        nonce: Buffer;
        payload: Buffer;
        pHash: Buffer;
        to: string;
    }): SubmitGatewayInput => {
        assertType<Buffer>("Buffer", {
            gHash,
            gPubKey,
            nHash,
            nonce,
            payload,
            pHash,
        });
        assertType<string>("string", { to });
        const txIn = {
            t: submitGatewayType(),
            v: {
                ghash: toURLBase64(gHash),
                gpubkey: toURLBase64(gPubKey),
                nhash: toURLBase64(nHash),
                nonce: toURLBase64(nonce),
                payload: toURLBase64(payload),
                phash: toURLBase64(pHash),
                to,
            },
        };
        return {
            selector: selector,
            version: "1",
            // TODO: Fix types
            in: txIn as unknown as SubmitGatewayInput["in"],
        };
    };

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
        output: { txid: string; txindex: string };
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
        });
        assertType<string>("string", {
            to,
            amount,
            txindex: output.txindex,
            txid: output.txid,
        });
        const txIn = {
            t: mintParamsType(),
            v: {
                txid: output.txid,
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
        const version = "1";
        return {
            hash: toURLBase64(hashTransaction(version, selector, txIn)),
            selector: selector,
            version,
            // TODO: Fix types
            in: txIn as unknown as MintTransactionInput["in"],
        };
    };

    public transactionHash = (params: {
        selector: string;
        gHash: Buffer;
        gPubKey: Buffer;
        nHash: Buffer;
        nonce: Buffer;
        output: { txindex: string; txid: string };
        amount: string;
        payload: Buffer;
        pHash: Buffer;
        to: string;
    }): Buffer => fromBase64(this.buildTransaction(params).hash);

    public submitTransaction = async (
        params: {
            selector: string;
            gHash: Buffer;
            gPubKey: Buffer;
            nHash: Buffer;
            nonce: Buffer;
            output: { txindex: string; txid: string };
            amount: string;
            payload: Buffer;
            pHash: Buffer;
            to: string;
        },
        retries?: number,
    ): Promise<Buffer> => {
        const tx = this.buildTransaction(params);
        await this.submitTx(tx, retries);
        return fromBase64(tx.hash);
    };

    public submitGatewayDetails = async (
        gateway: string,
        params: {
            selector: string;
            gHash: Buffer;
            gPubKey: Buffer;
            nHash: Buffer;
            nonce: Buffer;
            payload: Buffer;
            pHash: Buffer;
            to: string;
        },
        retries?: number,
    ): Promise<string> => {
        const tx = this.buildGateway(params);
        await this.submitGateway(gateway, tx, retries);
        return gateway;
    };

    /**
     * Queries the result of a RenVM transaction and unmarshals the result into
     * a [[LockAndMintTransaction]] or [[BurnAndReleaseTransaction]].
     *
     * @param renVMTxHash The transaction hash as a Buffer.
     */
    public readonly queryTransaction = async (
        _selector: string,
        renVMTxHash: Buffer,
        retries?: number,
    ): Promise<TxResponseWithStatus<CrossChainTxResponse>> => {
        try {
            const response = await this.queryTx(
                toURLBase64(renVMTxHash),
                retries,
            );
            console.log("got back response", response);

            return {
                tx: unmarshalCrossChainTxResponse(response.tx),
                txStatus: response.txStatus,
            };
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } catch (error: any) {
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
    public readonly waitForTX = async (
        selector: string,
        utxoTxHash: Buffer,
        onStatus?: (status: TxStatus) => void,
        _cancelRequested?: () => boolean,
        timeout?: number,
    ): Promise<TxResponseWithStatus<CrossChainTxResponse>> => {
        assertType<Buffer>("Buffer", { utxoTxHash });
        let rawResponse: TxResponseWithStatus<CrossChainTxResponse>;
        while (true) {
            if (_cancelRequested && _cancelRequested()) {
                throw new Error(`waitForTX cancelled.`);
            }

            try {
                const result = await this.queryTransaction(
                    selector,
                    utxoTxHash,
                );
                if (result && result.txStatus === TxStatus.TxStatusDone) {
                    rawResponse = result;
                    break;
                } else if (onStatus && result && result.txStatus) {
                    onStatus(result.txStatus);
                }
            } catch (error: unknown) {
                if (
                    error instanceof Error &&
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
     * @param selector A RenVM selector, e.g. 'BTC/toEthereum'.
     * @returns The public key hash (20 bytes) as a string.
     */
    public readonly selectPublicKey = async (
        asset: string,
    ): Promise<Buffer> => {
        // Call the ren_queryBlockState RPC.
        const renVMState = await this.queryBlockState(5);

        const blockState: BlockState = unmarshalTypedPackValue(
            renVMState.state,
        );

        if (!blockState[asset]) {
            throw new Error(`No RenVM block state found for ${asset}.`);
        }

        const pubKey = blockState[asset].shards[0].pubKey;

        if (!pubKey || pubKey.length === 0) {
            throw new Error(`Unable to fetch RenVM public key for ${asset}.`);
        }

        return fromBase64(pubKey);
    };

    public getNetwork = async (): Promise<string> =>
        (await this.queryConfig()).network;

    public getConfirmationTarget = async (chainName: string) => {
        const renVMConfig = await this.sendMessage(RPCMethod.QueryConfig, {});
        return parseInt(renVMConfig.confirmations[chainName], 10);
    };
}
