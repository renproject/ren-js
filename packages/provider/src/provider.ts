import {
    assertType,
    Logger,
    memoize,
    nullLogger,
    RenJSError,
    RenNetwork,
    RenNetworkString,
    RenVMShard,
    toURLBase64,
    unmarshalTypedPackValue,
    withCode,
} from "@renproject/utils";

import {
    ParamsQueryBlock,
    ParamsQueryBlocks,
    ParamsQueryTxs,
    ParamsSubmitGateway,
    ParamsSubmitTx,
    ResponseQueryBlock,
    ResponseQueryBlocks,
    ResponseQueryConfig,
    ResponseQueryTx,
    ResponseSubmitGateway,
    ResponseSubmitTx,
    RPCMethod,
    RPCParams,
    RPCResponses,
    SubmitGatewayInput,
    submitGatewayType,
} from "./methods";
import { BlockState } from "./methods/ren_queryBlockState";
import { HttpProvider, Provider } from "./rpc/jsonRpc";
import { renRpcUrls } from "./rpcUrls";
import {
    RenVMCrossChainTransaction,
    RenVMTransaction,
    RenVMTransactionWithStatus,
    unmarshalRenVMTransaction,
} from "./unmarshal";

export class RenVMProvider extends HttpProvider<RPCParams, RPCResponses> {
    public readonly logger: Logger;

    public constructor(
        endpointOrProvider:
            | RenNetwork
            | RenNetworkString
            | string
            | Provider<RPCParams, RPCResponses>,
        logger: Logger = nullLogger,
    ) {
        super(
            // Check if the first parameter is a provider to forward calls to.
            typeof endpointOrProvider !== "string"
                ? endpointOrProvider
                : renRpcUrls[endpointOrProvider] || endpointOrProvider,
        );
        this.logger = logger;
    }

    public queryBlock = async (
        blockHeight: ParamsQueryBlock["blockHeight"],
        retry?: number,
    ): Promise<ResponseQueryBlock> =>
        (
            await this.sendMessage<RPCMethod.QueryBlock>(
                RPCMethod.QueryBlock,
                { blockHeight },
                retry,
            )
        ).block;

    public queryBlocks = async (
        blockHeight: ParamsQueryBlocks["blockHeight"],
        n: ParamsQueryBlocks["n"],
        retry?: number,
    ): Promise<ResponseQueryBlocks> =>
        (
            await this.sendMessage<RPCMethod.QueryBlocks>(
                RPCMethod.QueryBlocks,
                { blockHeight, n },
                retry,
            )
        ).blocks;

    public submitGateway = async (
        gateway: ParamsSubmitGateway["gateway"],
        tx: ParamsSubmitGateway["tx"],
        retry?: number,
    ): Promise<ResponseSubmitGateway> =>
        this.sendMessage<RPCMethod.SubmitGateway>(
            RPCMethod.SubmitGateway,
            { gateway, tx },
            retry,
        );

    public submitTx = async (
        tx: ParamsSubmitTx["tx"],
        retry?: number,
    ): Promise<ResponseSubmitTx> =>
        this.sendMessage<RPCMethod.SubmitTx>(
            RPCMethod.SubmitTx,
            { tx } as ParamsSubmitTx,
            retry,
        );

    public queryTxs = async (
        tags: ParamsQueryTxs["tags"],
        page?: number,
        pageSize?: number,
        txStatus?: ParamsQueryTxs["txStatus"],
        retry?: number,
    ): Promise<RenVMTransaction[]> =>
        (
            await this.sendMessage<RPCMethod.QueryTxs>(
                RPCMethod.QueryTxs,
                {
                    tags,
                    page: (page || 0).toString(),
                    pageSize: (pageSize || 0).toString(),
                    txStatus,
                },
                retry,
            )
        ).txs.map((tx) => unmarshalRenVMTransaction(tx));

    public queryConfig = async (retry?: number): Promise<ResponseQueryConfig> =>
        this.sendMessage<RPCMethod.QueryConfig>(
            RPCMethod.QueryConfig,
            {},
            retry,
        );

    public queryBlockState = memoize(
        async (contract: string, retry?: number): Promise<BlockState> => {
            const { state } = await this.sendMessage<RPCMethod.QueryBlockState>(
                RPCMethod.QueryBlockState,
                { contract },
                retry,
            );
            return unmarshalTypedPackValue(state);
        },
    );

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
        const { selector, gHash, gPubKey, nHash, nonce, payload, pHash, to } =
            params;
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
            t: submitGatewayType,
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
        const tx = {
            selector: selector,
            version: "1",
            // TODO: Fix types
            in: txIn as unknown as SubmitGatewayInput["in"],
        };
        await this.submitGateway(gateway, tx, retries);
        return gateway;
    };

    /**
     * Queries the result of a RenVM transaction and unmarshals the result into
     * a [[LockAndMintTransaction]] or [[BurnAndReleaseTransaction]].
     *
     * @param txHash The transaction hash in URL-base64.
     */
    public readonly queryTx = async <
        T extends RenVMTransactionWithStatus = RenVMTransactionWithStatus<RenVMCrossChainTransaction>,
    >(
        txHash: string,
        retries?: number,
    ): Promise<T> => {
        assertType<string>("string", { txHash });

        let response: ResponseQueryTx;
        try {
            response = await this.sendMessage<RPCMethod.QueryTx>(
                RPCMethod.QueryTx,
                { txHash },
                retries,
            );
        } catch (error: any) {
            if (error.message.match(/^invalid params: /)) {
                throw withCode(error, RenJSError.PARAMETER_ERROR);
            } else if (error.message.match(/not found$/)) {
                throw withCode(error, RenJSError.TRANSACTION_NOT_FOUND);
            } else {
                throw withCode(error, RenJSError.UNKNOWN_ERROR);
            }
        }

        try {
            return {
                tx: unmarshalRenVMTransaction(response.tx),
                txStatus: response.txStatus,
            } as T;
        } catch (error: any) {
            throw withCode(error, RenJSError.INTERNAL_ERROR);
        }
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
    };

    /**
     * selectShard fetches the public key for the RenVM shard handling
     * the provided contract.
     */
    public readonly selectShard = async (
        asset: string,
    ): Promise<RenVMShard> => {
        let blockState: BlockState;

        try {
            // Call the ren_queryBlockState RPC.
            blockState = await this.queryBlockState(asset, 5);
        } catch (error: any) {
            throw withCode(
                new Error(
                    `Error fetching RenVM shards: ${String(error.message)}`,
                ),
                RenJSError.NETWORK_ERROR,
            );
        }

        if (!blockState[asset]) {
            throw new Error(`No RenVM block state found for ${asset}.`);
        }

        const pubKey = blockState[asset].shards[0].pubKey;

        if (!pubKey || pubKey.length === 0) {
            throw new Error(`Unable to fetch RenVM public key for ${asset}.`);
        }

        assertType<Buffer>("Buffer", { pubKey });

        return {
            gPubKey: toURLBase64(pubKey),
        };
    };

    public getNetwork = async (): Promise<string> =>
        (await this.queryConfig()).network;

    public getConfirmationTarget = async (
        chainName: string,
    ): Promise<number> => {
        const renVMConfig = await this.sendMessage(RPCMethod.QueryConfig, {});
        return parseInt(renVMConfig.confirmations[chainName], 10);
    };
}
