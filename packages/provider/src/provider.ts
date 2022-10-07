import {
    assertType,
    defaultLogger,
    ErrorWithCode,
    Logger,
    pack,
    RenJSError,
    RenNetwork,
    RenVMShard,
    TxStatus,
    utils,
} from "@renproject/utils";

import {
    ParamsSubmitTx,
    ResponseQueryTx,
    RPCMethod,
    RPCParams,
    RPCResponses,
    SubmitGatewayInput,
    submitGatewayType,
} from "./methods";
import { renVMBlockType } from "./methods/ren_queryBlock";
import { BlockState } from "./methods/ren_queryBlockState";
import { JsonRpcProvider, Provider } from "./rpc/jsonRpc";
import { renRpcUrls } from "./rpcUrls";
import {
    RenVMBlock,
    RenVMCrossChainTransaction,
    RenVMTransaction,
    RenVMTransactionWithStatus,
} from "./types/core";
import { unmarshalRenVMTransaction } from "./unmarshal";

export interface RenVMProviderInterface
    extends Provider<RPCParams, RPCResponses> {
    getNetwork: () => Promise<string>;

    queryBlock: (blockHeight: number, retry?: number) => Promise<RenVMBlock>;

    queryBlocks: (
        blockHeight: number,
        n: number,
        retry?: number,
    ) => Promise<RenVMBlock[]>;

    submitTx: (tx: ParamsSubmitTx["tx"], retry?: number) => Promise<void>;

    /**
     * Queries the result of a RenVM transaction and unmarshals the result into
     * a [[RenVMCrossChainTransaction]].
     *
     * @param txHash The transaction hash in URL-base64.
     */
    queryTx: <
        T extends RenVMTransactionWithStatus = RenVMTransactionWithStatus<RenVMCrossChainTransaction>,
    >(
        txHash: string,
        retries?: number,
    ) => Promise<T>;

    queryTxs: (
        {
            txStatus,
            offset,
            limit,
            latest,
        }: {
            // TxStatus specifies the status of transactions that will be returned.
            txStatus?: TxStatus;

            // Offset specifies the number of transactions that should be skipped. A nil
            // value can be used to request the default offset.
            offset?: number;

            // Limit specifies the number of transactions that should be returned. A nil
            // value can be used to request the default limit.
            limit?: number;

            // Latest specifies the ordering of returned Txs in the Lightnode.
            // If true, it will order by the creation time in descending order,
            // if false (default) it will list the oldest txs first
            latest?: boolean;
        },
        retries?: number,
    ) => Promise<RenVMTransaction[]>;

    queryBlockState: (contract: string, retry?: number) => Promise<BlockState>;

    submitGateway: (
        gateway: string,
        params: {
            selector: string;
            gHash: Uint8Array;
            gPubKey: Uint8Array;
            nHash: Uint8Array;
            nonce: Uint8Array;
            payload: Uint8Array;
            pHash: Uint8Array;
            to: string;
        },
        retries?: number,
    ) => Promise<string>;

    /**
     * selectShard fetches the key for the RenVM shard handling
     * the provided contract.
     */
    selectShard: (asset: string) => Promise<RenVMShard>;

    getConfirmationTarget: (chainName: string) => Promise<number>;
}

/**
 * The RenVMProvider implements the Provider interface by inheriting from
 * JsonRpcProvider, and extends it with helper methods for calling sendMessage,
 * including marshalling and unmarshalling responses.
 */
export class RenVMProvider extends JsonRpcProvider<RPCParams, RPCResponses> {
    public logger: Logger;

    public constructor(
        endpointOrProvider:
            | RenNetwork
            | `${RenNetwork}`
            | string
            | Provider<RPCParams, RPCResponses>,
        logger: Logger = defaultLogger,
    ) {
        super(
            // Check if the first parameter is a provider to forward calls to.
            typeof endpointOrProvider !== "string"
                ? endpointOrProvider
                : renRpcUrls[endpointOrProvider] || endpointOrProvider,
        );
        this.logger = logger;
    }

    public getNetwork = async (): Promise<string> => {
        const renVMConfig = await this.queryConfig();
        return renVMConfig.network;
    };

    public queryBlock = async (
        blockHeight?: number,
        retry?: number,
    ): Promise<RenVMBlock> =>
        pack.unmarshal.unmarshalPackStruct(
            renVMBlockType,
            (
                await this.sendMessage<RPCMethod.QueryBlock>(
                    RPCMethod.QueryBlock,
                    {
                        blockHeight: utils.isDefined(blockHeight)
                            ? blockHeight.toString()
                            : undefined,
                    },
                    retry,
                )
            ).block,
        );

    public queryBlocks = async (
        blockHeight?: number,
        n?: number,
        retry?: number,
    ): Promise<RenVMBlock[]> =>
        pack.unmarshal.unmarshalPackList(
            { list: renVMBlockType },
            (
                await this.sendMessage<RPCMethod.QueryBlocks>(
                    RPCMethod.QueryBlocks,
                    {
                        blockHeight: utils.isDefined(blockHeight)
                            ? blockHeight.toString()
                            : undefined,
                        n: utils.isDefined(n) ? n.toString() : undefined,
                    },
                    retry,
                )
            ).blocks,
        );

    public submitTx = async (
        tx: ParamsSubmitTx["tx"],
        retry?: number,
    ): Promise<void> => {
        await this.sendMessage<RPCMethod.SubmitTx>(
            RPCMethod.SubmitTx,
            { tx } as ParamsSubmitTx,
            retry,
        );
    };

    public queryTxs = async (
        {
            txStatus,
            offset,
            limit,
            latest,
        }: {
            // TxStatus specifies the status of transactions that will be returned.
            txStatus?: TxStatus;

            // Offset specifies the number of transactions that should be skipped. A nil
            // value can be used to request the default offset.
            offset?: number;

            // Limit specifies the number of transactions that should be returned. A nil
            // value can be used to request the default limit.
            limit?: number;

            // Latest specifies the ordering of returned Txs in the Lightnode.
            // If true, it will order by the creation time in descending order,
            // if false (default) it will list the oldest txs first
            latest?: boolean;
        },
        // Retry specifies how many attempts should be made to fetch the
        // result of the queryTxs.
        retry?: number,
    ): Promise<RenVMTransaction[]> =>
        (
            await this.sendMessage<RPCMethod.QueryTxs>(
                RPCMethod.QueryTxs,
                {
                    ...(utils.isDefined(txStatus)
                        ? { txStatus: txStatus }
                        : {}),

                    ...(utils.isDefined(limit)
                        ? { limit: limit.toString() }
                        : {}),

                    ...(utils.isDefined(offset)
                        ? { offset: offset.toString() }
                        : {}),

                    ...(utils.isDefined(latest) ? { latest: latest } : {}),
                },
                retry,
            )
        ).txs.map((tx) => unmarshalRenVMTransaction(tx));

    public queryConfig = utils.memoize(
        async (retry?: number) =>
            await this.sendMessage<RPCMethod.QueryConfig>(
                RPCMethod.QueryConfig,
                {},
                retry,
            ),
    );

    public queryBlockState = utils.memoize(
        async (contract: string, retry?: number): Promise<BlockState> => {
            const { state } = await this.sendMessage<RPCMethod.QueryBlockState>(
                RPCMethod.QueryBlockState,
                { contract },
                retry,
            );
            return pack.unmarshal.unmarshalTypedPackValue(state);
        },
    );

    public submitGateway = async (
        gateway: string,
        params: {
            selector: string;
            gHash: Uint8Array;
            gPubKey: Uint8Array;
            nHash: Uint8Array;
            nonce: Uint8Array;
            payload: Uint8Array;
            pHash: Uint8Array;
            to: string;
        },
        retries?: number,
    ): Promise<string> => {
        const { selector, gHash, gPubKey, nHash, nonce, payload, pHash, to } =
            params;
        assertType<Uint8Array>("Uint8Array", {
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
                ghash: utils.toURLBase64(gHash),
                gpubkey: utils.toURLBase64(gPubKey),
                nhash: utils.toURLBase64(nHash),
                nonce: utils.toURLBase64(nonce),
                payload: utils.toURLBase64(payload),
                phash: utils.toURLBase64(pHash),
                to,
            },
        };
        const tx = {
            selector: selector,
            version: "1",
            // TODO: Fix types
            in: txIn as unknown as SubmitGatewayInput["in"],
        };

        await this.sendMessage<RPCMethod.SubmitGateway>(
            RPCMethod.SubmitGateway,
            { gateway, tx },
            retries,
        );

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
        } catch (error: unknown) {
            const message = (error as Error).message || "";
            if (message.match(/^invalid params: /)) {
                throw ErrorWithCode.updateError(
                    error,
                    RenJSError.PARAMETER_ERROR,
                );
            } else if (message.match(/not found$/)) {
                throw ErrorWithCode.updateError(
                    error,
                    RenJSError.TRANSACTION_NOT_FOUND,
                );
            } else {
                throw ErrorWithCode.updateError(
                    error,
                    RenJSError.UNKNOWN_ERROR,
                );
            }
        }

        try {
            return {
                tx: unmarshalRenVMTransaction(response.tx),
                txStatus: response.txStatus,
            } as T;
        } catch (error: unknown) {
            throw ErrorWithCode.updateError(
                error,
                (error as ErrorWithCode).code || RenJSError.INTERNAL_ERROR,
            );
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
        } catch (error: unknown) {
            throw ErrorWithCode.updateError(
                error,
                RenJSError.NETWORK_ERROR,
                `Error fetching RenVM shards`,
            );
        }

        if (!blockState[asset]) {
            throw new Error(`No RenVM block state found for ${asset}.`);
        }

        const pubKey = blockState[asset].shards[0].pubKey;

        if (!pubKey || pubKey.length === 0) {
            throw new Error(`Unable to fetch RenVM public key for ${asset}.`);
        }

        assertType<Uint8Array>("Uint8Array", { pubKey });

        return {
            gPubKey: utils.toURLBase64(pubKey),
        };
    };

    public getConfirmationTarget = async (
        chainName: string,
    ): Promise<number> => {
        const renVMConfig = await this.queryConfig();
        return parseInt(renVMConfig.confirmations[chainName], 10);
    };

    public selectorWhitelisted = async (selector: string): Promise<boolean> => {
        const renVMConfig = await this.queryConfig();
        return renVMConfig.whitelist.includes(selector);
    };
}
