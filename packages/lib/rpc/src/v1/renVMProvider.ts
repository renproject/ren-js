import {
    AbiItem,
    BurnAndReleaseTransaction,
    getRenNetworkDetails,
    LockAndMintTransaction,
    LockChain,
    Logger,
    MintChain,
    NullLogger,
    RenJSErrors,
    RenNetwork,
    RenNetworkDetails,
    RenNetworkString,
    TxStatus,
} from "@renproject/interfaces";
import { HttpProvider, Provider } from "@renproject/provider";
import {
    assertType,
    extractError,
    fromBase64,
    keccak256,
    parseV1Selector,
    SECONDS,
    sleep,
    strip0x,
    toBase64,
} from "@renproject/utils";
import BigNumber from "bignumber.js";
import { List } from "immutable";

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
    ResponseQueryBurnTx,
    ResponseQueryMintTx,
    RPCMethod,
} from "./methods";
import { unmarshalBurnTx, unmarshalFees, unmarshalMintTx } from "./unmarshal";
import { RenVMType } from "./value";

export const generateMintTxHash = (
    selector: string,
    encodedID: string,
    deposit: string,
    logger: Logger = NullLogger,
): Buffer => {
    // Type validation
    assertType<string>("string", { encodedID, deposit });

    const message = `txHash_${selector}_${encodedID}_${deposit}`;
    const digest = keccak256(Buffer.from(message));
    logger.debug("Mint txHash", toBase64(digest), message);
    return digest;
};

export class RenVMProvider
    implements AbstractRenVMProvider<RenVMParams, RenVMResponses> {
    public version = () => 1;

    private readonly network: RenNetwork;

    public readonly provider: Provider<RenVMParams, RenVMResponses>;
    sendMessage: RenVMProvider["provider"]["sendMessage"];
    private readonly logger: Logger;

    constructor(
        network: RenNetwork | RenNetworkString | RenNetworkDetails,
        provider?: Provider<RenVMParams, RenVMResponses>,
        logger: Logger = NullLogger,
    ) {
        if (!provider) {
            const rpcUrl = getRenNetworkDetails(network).lightnode;
            try {
                provider = new HttpProvider<RenVMParams, RenVMResponses>(
                    rpcUrl,
                    logger,
                ) as Provider<RenVMParams, RenVMResponses>;
            } catch (error) {
                if (/Invalid node URL/.exec(String(error && error.message))) {
                    throw new Error(
                        `Invalid network or provider URL: "${
                            getRenNetworkDetails(network).name
                        }"`,
                    );
                }
                throw error;
            }
        }

        this.network = network as RenNetwork;
        this.logger = logger;
        this.provider = provider;
        this.sendMessage = async <Method extends keyof RenVMParams & string>(
            method: Method,
            request: RenVMParams[Method],
            retry = 2,
            timeout = 120 * SECONDS,
        ) => {
            try {
                return await this.provider.sendMessage(
                    method,
                    request,
                    retry,
                    timeout,
                );
            } catch (error) {
                const errorString = extractError(error);
                if (/(tx hash=[a-zA-Z0-9+\/=]+ not found)/.exec(errorString)) {
                    error.code = RenJSErrors.RenVMTransactionNotFound;
                }
                if (/(insufficient funds)/.exec(errorString)) {
                    error.code = RenJSErrors.AmountTooSmall;
                }
                if (/(utxo spent or invalid index)/.exec(errorString)) {
                    error.code = RenJSErrors.DepositSpentOrNotFound;
                }
                throw error;
            }
        };
    }

    public selector = ({
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
        return `${asset}0${from.legacyName || from.name}2${
            to.legacyName || from.name
        }`;
    };

    public queryBlock = async (
        blockHeight: ParamsQueryBlock["blockHeight"],
        retry?: number,
    ) =>
        this.sendMessage<RPCMethod.MethodQueryBlock>(
            RPCMethod.MethodQueryBlock,
            { blockHeight },
            retry,
        );

    public queryBlocks = async (
        blockHeight: ParamsQueryBlocks["blockHeight"],
        n: ParamsQueryBlocks["n"],
        retry?: number,
    ) =>
        this.sendMessage<RPCMethod.MethodQueryBlocks>(
            RPCMethod.MethodQueryBlocks,
            { blockHeight, n },
            retry,
        );

    public submitTx = async (
        tx: ParamsSubmitBurn["tx"] | ParamsSubmitMint["tx"],
        retry?: number,
    ) =>
        this.sendMessage<RPCMethod.MethodSubmitTx>(
            RPCMethod.MethodSubmitTx,
            { tx } as ParamsSubmitBurn | ParamsSubmitMint,
            retry,
        );

    public queryTx = async (txHash: ParamsQueryTx["txHash"], retry?: number) =>
        this.sendMessage<RPCMethod.MethodQueryTx>(
            RPCMethod.MethodQueryTx,
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
        this.sendMessage<RPCMethod.MethodQueryTxs>(
            RPCMethod.MethodQueryTxs,
            {
                tags,
                page: (page || 0).toString(),
                pageSize: (pageSize || 0).toString(),
                txStatus,
            },
            retry,
        );

    public queryNumPeers = async (retry?: number) =>
        this.sendMessage<RPCMethod.MethodQueryNumPeers>(
            RPCMethod.MethodQueryNumPeers,
            {},
            retry,
        );

    public queryPeers = async (retry?: number) =>
        this.sendMessage<RPCMethod.MethodQueryPeers>(
            RPCMethod.MethodQueryPeers,
            {},
            retry,
        );

    public queryShards = async (retry?: number) =>
        this.sendMessage<RPCMethod.MethodQueryShards>(
            RPCMethod.MethodQueryShards,
            {},
            retry,
        );

    public queryStat = async (retry?: number) =>
        this.sendMessage<RPCMethod.MethodQueryStat>(
            RPCMethod.MethodQueryStat,
            {},
            retry,
        );

    public queryFees = async (retry?: number) =>
        this.sendMessage<RPCMethod.MethodQueryFees>(
            RPCMethod.MethodQueryFees,
            {},
            retry,
        );

    public getFees = async () => unmarshalFees(await this.queryFees());

    public mintTxHash = ({
        selector,
        gHash,
        outputHashFormat,
    }: {
        selector: string;
        gHash: Buffer;
        outputHashFormat: string;
    }): Buffer => {
        assertType<Buffer>("Buffer", { gHash });
        assertType<string>("string", { outputHashFormat });
        return generateMintTxHash(
            selector,
            toBase64(gHash),
            outputHashFormat,
            this.logger,
        );
    };

    public submitMint = async ({
        selector,
        nonce,
        output,
        payload,
        to,
        token,
        fn,
        fnABI,
        tags,
    }: {
        selector: string;
        nonce: Buffer;
        output: { txindex: string; txid: Buffer };
        payload: Buffer;
        to: string;
        token: string;
        fn: string;
        fnABI: AbiItem[];
        tags: [string] | [];
    }): Promise<Buffer> => {
        const { txindex, txid } = output;

        assertType<Buffer>("Buffer", { nonce, payload, txid });
        assertType<string>("string", { to, token, fn, txindex });

        const response = await this.sendMessage<RPCMethod.MethodSubmitTx>(
            RPCMethod.MethodSubmitTx,
            {
                tx: {
                    to: selector,
                    in: [
                        //
                        {
                            name: "p" as const,
                            type: RenVMType.ExtEthCompatPayload,
                            value: {
                                abi: toBase64(
                                    Buffer.from(JSON.stringify(fnABI)),
                                ),
                                value: toBase64(payload),
                                fn: toBase64(Buffer.from(fn)),
                            },
                        },
                        // The hash of the payload data
                        // { name: "phash" as const, type: RenVMType.B32 as const, value: toBase64(pHash) },
                        // The amount of BTC (in SATs) that has be transferred to the gateway
                        // { name: "amount" as const, type: "u64", as const value: amount },
                        // The ERC20 contract address on Ethereum for BTC
                        {
                            name: "token" as const,
                            type: RenVMType.ExtTypeEthCompatAddress,
                            value: strip0x(token),
                        },
                        // The address on the Ethereum blockchain to which BTC will be transferred
                        {
                            name: "to" as const,
                            type: RenVMType.ExtTypeEthCompatAddress,
                            value: strip0x(to),
                        },
                        // The nonce is used to randomize the gateway
                        {
                            name: "n" as const,
                            type: RenVMType.B32,
                            value: toBase64(nonce),
                        },

                        // UTXO
                        {
                            name: "utxo" as const,
                            type: RenVMType.ExtTypeBtcCompatUTXO,
                            value: {
                                txHash: toBase64(txid),
                                vOut: txindex,
                            },
                        },
                    ],
                },
                tags,
            },
        );

        return fromBase64(response.tx.hash);
    };

    public submitBurn = async (params: {
        selector: string;
        tags: [string] | [];

        // v1
        burnNonce: BigNumber;
    }): Promise<Buffer> => {
        const { selector, burnNonce, tags } = params;
        const response = await this.sendMessage(RPCMethod.MethodSubmitTx, {
            tx: {
                to: selector,
                in: [
                    {
                        name: "ref",
                        type: RenVMType.U64,
                        value: burnNonce.decimalPlaces(0).toFixed(),
                    },
                ],
            },
            tags,
        });

        return fromBase64(response.tx.hash);
    };

    public readonly queryMintOrBurn = async <
        T extends LockAndMintTransaction | BurnAndReleaseTransaction
    >(
        _selector: string,
        utxoTxHash: Buffer,
    ): Promise<T> => {
        const response = await this.queryTx(toBase64(utxoTxHash));
        // Unmarshal transaction.
        const { asset, from } = parseV1Selector(response.tx.to);
        if (asset.toUpperCase() === from.toUpperCase()) {
            return unmarshalMintTx(response as ResponseQueryMintTx) as T;
        } else {
            return unmarshalBurnTx(response as ResponseQueryBurnTx) as T;
        }
    };

    public readonly waitForTX = async <
        T extends LockAndMintTransaction | BurnAndReleaseTransaction
    >(
        selector: string,
        utxoTxHash: Buffer,
        onStatus?: (status: TxStatus) => void,
        _cancelRequested?: () => boolean,
    ): Promise<T> => {
        assertType<Buffer>("Buffer", { utxoTxHash });
        let rawResponse;
        while (true) {
            if (_cancelRequested && _cancelRequested()) {
                throw new Error(`waitForTX cancelled`);
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
            await sleep(15 * SECONDS);
        }
        return rawResponse;
    };

    /**
     * selectPublicKey fetches the public key for the RenVM shard handling
     * the provided contract.
     *
     * @param asset The asset for which the public key should be fetched.
     * @returns The public key hash (20 bytes) as a string.
     */
    public readonly selectPublicKey = async (
        _selector: string,
        asset: string,
    ): Promise<Buffer> => {
        // Call the ren_queryShards RPC.
        const response = await this.queryShards(5);

        // Prioritize primary shards.
        const chosenShard = response.shards.sort((a, b) =>
            a.primary && b.primary ? -1 : a.primary ? -1 : b.primary ? 1 : 0,
        )[0];

        if (!chosenShard) {
            throw new Error(
                "Unable to load public key from RenVM: no shards found",
            );
        }

        // Get the gateway pubKey from the gateway with the right asset within
        // the shard with the lowest total value locked.
        const tokenGateway = List(chosenShard.gateways)
            .filter((gateway) => gateway.asset === asset)
            .first(undefined);

        if (!tokenGateway) {
            throw new Error(
                `Unable to load public key from RenVM: no gateway for the asset ${asset}`,
            );
        }

        // Use this gateway pubKey to build the gateway address.
        // return hash160(
        return fromBase64(tokenGateway.pubKey);
    };

    // In the future, this will be asynchronous. It returns a promise for
    // compatibility.
    // eslint-disable-next-line @typescript-eslint/require-await
    public getNetwork = async (_selector: string): Promise<RenNetwork> => {
        return this.network;
    };

    public estimateTransactionFee = async (
        _selector: string,
        chain: { name: string; legacyName?: string },
    ): Promise<{ lock: BigNumber; release: BigNumber }> => {
        const fees = await this.getFees();
        return fees[
            chain.legacyName
                ? chain.legacyName.toLowerCase()
                : chain.name.toLowerCase()
        ];
    };
}
