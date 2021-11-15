import BigNumber from "bignumber.js";
import elliptic from "elliptic";
import { ecsign, privateToAddress } from "ethereumjs-util";
import { defaultAbiCoder } from "ethers/lib/utils";
import { OrderedMap } from "immutable";

import {
    CrossChainParams,
    ParamsQueryConfig,
    ParamsQueryTx,
    ParamsSubmitTx,
    ResponseQueryConfig,
    ResponseQueryTx,
    ResponseSubmitTx,
    RPCMethod,
    RPCParams,
    RPCResponses,
    TransactionInput,
} from "@renproject/provider/build/main/methods";
import {
    ParamsQueryBlockState,
    ResponseQueryBlockState,
} from "@renproject/provider/build/main/methods/ren_queryBlockState";
import {
    ChainCommon,
    fromBase64,
    fromHex,
    keccak256,
    Ox,
    PackPrimitive,
    PackStructType,
    PackTypeDefinition,
    toURLBase64,
    TxStatus,
    TypedPackValue,
} from "@renproject/utils";

import { Provider } from "../../provider/build/main/rpc/jsonRpc";
import { MockChain } from "./MockChain";
import { randomBytes } from "./utils";

export const responseQueryParamsType: PackStructType = {
    struct: [
        {
            amount: PackPrimitive.U256,
        },
        {
            hash: PackPrimitive.Bytes32,
        },
        {
            sighash: PackPrimitive.Bytes32,
        },
        {
            sig: PackPrimitive.Bytes65,
        },
        {
            txid: PackPrimitive.Bytes,
        },
        {
            txindex: PackPrimitive.U32,
        },
        {
            revert: PackPrimitive.Str,
        },
    ],
};

export class MockProvider implements Provider<RPCParams, RPCResponses> {
    private privateKeyBuffer;
    private transactions: Map<string, ResponseQueryTx>;

    // Map from chain name to chain class
    private supportedChains = OrderedMap<string, ChainCommon>();
    // Map from asset name to chain name
    private supportedAssets = OrderedMap<string, string>();

    constructor(privateKey?: Buffer) {
        this.privateKeyBuffer = privateKey || randomBytes(32);
        this.transactions = new Map();
    }

    public mintAuthority = () =>
        Ox(privateToAddress(this.privateKeyBuffer).toString("hex"));

    public registerChain = (chain: ChainCommon, assets?: string[]) => {
        this.supportedChains = this.supportedChains.set(chain.chain, chain);
        for (const asset of [
            ...Object.values(chain.assets),
            ...(assets || []),
        ]) {
            this.registerAsset(asset, chain);
        }
    };

    public registerAsset = (asset: string, chain: ChainCommon) => {
        this.supportedAssets = this.supportedAssets.set(asset, chain.chain);
    };

    sendMessage<Method extends keyof RPCParams & string>(
        method: Method,
        request: RPCParams[Method],
    ): RPCResponses[Method] {
        try {
            switch (method) {
                case RPCMethod.SubmitTx:
                    return this.handle_submitTx(
                        request as ParamsSubmitTx<
                            TransactionInput<CrossChainParams>
                        >,
                    ) as RPCResponses[Method];
                case RPCMethod.QueryTx:
                    return this.handle_queryTx(
                        request as ParamsQueryTx,
                    ) as RPCResponses[Method];
                case RPCMethod.QueryConfig:
                    return this.handle_queryConfig(
                        request,
                    ) as RPCResponses[Method];
                case RPCMethod.QueryBlockState:
                    return this.handle_queryBlockState(
                        request,
                    ) as RPCResponses[Method];
            }
            throw new Error(`Method ${method} not supported.`);
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } catch (error: any) {
            throw error;
        }
    }

    private handle_submitTx = (
        request: ParamsSubmitTx<TransactionInput<CrossChainParams>>,
    ): ResponseSubmitTx => {
        const selector = request.tx.selector;
        const inputs = request.tx.in.v;

        const pHash = fromBase64(inputs.phash);
        const nHash = fromBase64(inputs.nhash);
        const to = fromHex(inputs.to);

        let completedTransaction: ResponseQueryTx;
        if (/\/from/.exec(selector)) {
            // BURN //

            const amountIn = inputs.amount;

            const amountOut = new BigNumber(amountIn).minus(1000).toFixed();

            let txid = toURLBase64(randomBytes(32));
            let txindex = "0";

            const asset = selector.split("/")[0];
            const chainName = this.supportedAssets.get(asset);
            if (chainName) {
                const chain = this.supportedChains.get(chainName);
                if ((chain as MockChain).addUTXO) {
                    const utxo = (chain as MockChain).addUTXO(
                        request.tx.in.v.to,
                        new BigNumber(amountOut),
                    );
                    txid = toURLBase64(fromHex(utxo.txid).reverse());
                    txindex = utxo.txindex;
                }
            }

            completedTransaction = {
                ...request,
                txStatus: TxStatus.TxStatusDone,
                tx: {
                    ...request.tx,
                    version: "1",
                    in: request.tx.in as TypedPackValue,
                    out: {
                        t: responseQueryParamsType,
                        v: {
                            amount: amountOut,
                            hash: request.tx.hash,
                            revert: undefined,
                            sig: "",
                            sighash: "",
                            txid,
                            txindex,
                        },
                    },
                },
            };
        } else {
            // MINT //

            const amountIn = inputs.amount;
            const sHash = keccak256(Buffer.from(selector));

            const amountOut = new BigNumber(amountIn).minus(1000).toFixed();

            // Generate signature
            const sigParams = defaultAbiCoder.encode(
                ["bytes32", "uint256", "bytes32", "address", "bytes32"],
                [pHash, amountOut, sHash, Ox(to), nHash],
            );
            const sigHash = keccak256(fromHex(sigParams));
            const sig = ecsign(sigHash, this.privateKeyBuffer);
            const sigOut = toURLBase64(
                Buffer.concat([sig.r, sig.s, Buffer.from([sig.v])]),
            );

            completedTransaction = {
                ...request,
                txStatus: TxStatus.TxStatusDone,
                tx: {
                    ...request.tx,
                    version: "1",
                    in: request.tx.in as TypedPackValue,
                    out: {
                        t: responseQueryParamsType,
                        v: {
                            amount: amountOut,
                            hash: request.tx.hash,
                            revert: undefined,
                            sig: sigOut,
                            sighash: toURLBase64(sigHash),
                            txid: "",
                            txindex: "0",
                        },
                    },
                },
            };
        }

        this.transactions.set(
            completedTransaction.tx.hash,
            completedTransaction,
        );

        // TODO: Fix type.
        return {} as ResponseSubmitTx;
    };

    private handle_queryTx = (request: ParamsQueryTx): ResponseQueryTx => {
        const tx = this.transactions.get(request.txHash);
        if (tx) {
            return tx;
        } else {
            throw new Error(`Transaction ${request.txHash} not found.`);
        }
    };

    private handle_queryConfig = (
        _request: ParamsQueryConfig,
    ): ResponseQueryConfig => ({
        network: "dev",
        maxConfirmations: this.supportedChains.reduce(
            (acc, chain) => ({ ...acc, [chain.chain]: 100 }),
            {},
        ),
        registries: this.supportedChains.reduce(
            (acc, chain) => ({ ...acc, [chain.chain]: "" }),
            {},
        ),
        confirmations: this.supportedChains.reduce(
            (acc, chain) => ({ ...acc, [chain.chain]: 0 }),
            {},
        ),
        whitelist: [],
    });

    private handle_queryBlockState = (
        _request: ParamsQueryBlockState,
    ): ResponseQueryBlockState => {
        const ec = new elliptic.ec("secp256k1");
        const k = ec.keyFromPrivate(this.privateKeyBuffer);
        const key = Buffer.concat([
            Buffer.from([3]),
            k.getPublic().getX().toArrayLike(Buffer, "be", 32),
        ]);

        const assetPackType: PackTypeDefinition = {
            struct: [
                {
                    latestHeight: PackPrimitive.U256,
                },
                {
                    gasCap: PackPrimitive.U256,
                },
                {
                    gasLimit: PackPrimitive.U256,
                },
                {
                    gasPrice: PackPrimitive.U256,
                },
                {
                    minimumAmount: PackPrimitive.U256,
                },
                {
                    dustAmount: PackPrimitive.U256,
                },
                {
                    shards: {
                        list: {
                            struct: [
                                {
                                    shard: PackPrimitive.Bytes32,
                                },
                                {
                                    pubKey: PackPrimitive.Bytes,
                                },
                                {
                                    queue: {
                                        list: {
                                            struct: [
                                                {
                                                    hash: PackPrimitive.Bytes32,
                                                },
                                            ],
                                        },
                                    },
                                },
                                {
                                    state: {
                                        struct: [
                                            {
                                                outpoint: {
                                                    struct: [
                                                        {
                                                            hash: PackPrimitive.Bytes,
                                                        },
                                                        {
                                                            index: PackPrimitive.U32,
                                                        },
                                                    ],
                                                },
                                            },
                                            {
                                                value: PackPrimitive.U256,
                                            },
                                            {
                                                pubKeyScript:
                                                    PackPrimitive.Bytes,
                                            },
                                        ],
                                    },
                                },
                            ],
                        },
                    },
                },
                {
                    minted: {
                        list: {
                            struct: [
                                {
                                    chain: PackPrimitive.Str,
                                },
                                {
                                    amount: PackPrimitive.U256,
                                },
                            ],
                        },
                    },
                },
                {
                    fees: {
                        struct: [
                            {
                                reserved: {
                                    struct: [
                                        {
                                            fund: PackPrimitive.U256,
                                        },
                                    ],
                                },
                            },
                            {
                                unassigned: PackPrimitive.U256,
                            },
                            {
                                unclaimed: PackPrimitive.U256,
                            },
                            {
                                epochs: {
                                    list: {
                                        struct: [
                                            {
                                                epoch: PackPrimitive.U64,
                                            },
                                            {
                                                amount: PackPrimitive.U256,
                                            },
                                            {
                                                numNodes: PackPrimitive.U64,
                                            },
                                        ],
                                    },
                                },
                            },
                            {
                                nodes: {
                                    list: {
                                        struct: [
                                            {
                                                node: PackPrimitive.Bytes32,
                                            },
                                            {
                                                amountClaimed:
                                                    PackPrimitive.U256,
                                            },
                                            {
                                                nonce: PackPrimitive.U64,
                                            },
                                        ],
                                    },
                                },
                            },
                            {
                                chains: {
                                    list: {
                                        struct: [
                                            {
                                                chain: PackPrimitive.Str,
                                            },
                                            {
                                                mintFee: PackPrimitive.U64,
                                            },
                                            {
                                                burnFee: PackPrimitive.U64,
                                            },
                                        ],
                                    },
                                },
                            },
                        ],
                    },
                },
            ],
        };

        const v = this.supportedAssets
            .map(
                () =>
                    ({
                        dustAmount: "546",
                        fees: {
                            chains: this.supportedChains
                                .map((chain) => ({
                                    chain: chain.chain,
                                    burnFee: "15",
                                    mintFee: "15",
                                }))
                                .valueSeq()
                                .toArray(),
                            epochs: [],
                            nodes: [],
                            reserved: {
                                fund: "0",
                            },
                            unassigned: "0",
                            unclaimed: "0",
                        } as any,
                        gasCap: "2",
                        gasLimit: "400",
                        gasPrice: "2",
                        latestHeight: "0",
                        minimumAmount: "547",
                        minted: [],
                        shards: [
                            {
                                pubKey: toURLBase64(key),
                                queue: [],
                                shard: "",
                                state: {
                                    outpoint: {
                                        hash: "",
                                        index: "",
                                    },
                                    pubKeyScript: "",
                                    value: "",
                                },
                            },
                        ],
                    } as ResponseQueryBlockState["state"]["v"]["asset"]),
            )
            .toJS() as {
            [key: string]: ResponseQueryBlockState["state"]["v"]["asset"];
        };

        return {
            state: {
                t: {
                    struct: this.supportedAssets
                        .keySeq()
                        .toArray()
                        .map((x) => ({
                            [x]: assetPackType,
                        })),
                },
                v,
            },
        };
    };
}
