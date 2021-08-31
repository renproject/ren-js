import { Provider } from "@renproject/provider";
import {
    PackPrimitive,
    PackStructType,
    PackTypeDefinition,
    TypedPackValue,
} from "@renproject/rpc/build/main/v2";
import {
    ParamsQueryConfig,
    ParamsQueryTx,
    ParamsSubmitTx,
    RenVMParams,
    RenVMResponses,
    ResponseQueryConfig,
    ResponseQueryTx,
    ResponseSubmitTx,
    RPCMethod,
} from "@renproject/rpc/build/main/v2/methods";
import {
    BurnTransactionInput,
    MintParams,
    MintTransactionInput,
} from "@renproject/rpc/build/main/v2/transaction";
import {
    fromBase64,
    fromHex,
    keccak256,
    Ox,
    randomBytes,
    toURLBase64,
} from "@renproject/utils";
import { ecsign, privateToAddress } from "ethereumjs-util";
import BigNumber from "bignumber.js";
import { ChainCommon, TxStatus } from "@renproject/interfaces";
import elliptic from "elliptic";
import { defaultAbiCoder } from "ethers/lib/utils";
import {
    ParamsQueryBlockState,
    ResponseQueryBlockState,
} from "@renproject/rpc/build/main/v2/methods/ren_queryBlockState";
import { OrderedMap } from "immutable";

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

export class MockProvider implements Provider<RenVMParams, RenVMResponses> {
    private privateKeyBuffer;
    private transactions: Map<string, ResponseQueryTx>;
    private supportedChains: string[] = [];
    private supportedAssets: string[] = [];

    constructor(privateKey?: Buffer) {
        this.privateKeyBuffer = privateKey || randomBytes(32);
        this.transactions = new Map();
    }

    public mintAuthority = () =>
        Ox(privateToAddress(this.privateKeyBuffer).toString("hex"));

    public registerChain = (chain: ChainCommon) => {
        this.supportedChains.push(chain.name);
    };

    public registerAsset = (asset: string) => {
        this.supportedAssets.push(asset);
    };

    sendMessage<Method extends keyof RenVMParams & string>(
        method: Method,
        request: RenVMParams[Method],
    ): RenVMResponses[Method] {
        try {
            switch (method) {
                case RPCMethod.SubmitTx:
                    return this.handle_submitTx(
                        request as ParamsSubmitTx<
                            MintTransactionInput | BurnTransactionInput
                        >,
                    ) as RenVMResponses[Method];
                case RPCMethod.QueryTx:
                    return this.handle_queryTx(
                        request as ParamsQueryTx,
                    ) as RenVMResponses[Method];
                case RPCMethod.QueryConfig:
                    return this.handle_queryConfig(
                        request,
                    ) as RenVMResponses[Method];
                case RPCMethod.QueryBlockState:
                    return this.handle_queryBlockState(
                        request,
                    ) as RenVMResponses[Method];
            }
            throw new Error(`Method ${method} not supported.`);
        } catch (error) {
            throw error;
        }
    }

    public handle_submitTx = (
        request: ParamsSubmitTx<MintTransactionInput | BurnTransactionInput>,
    ): ResponseSubmitTx => {
        const selector = request.tx.selector;

        const inputs = (request.tx.in as MintParams).v;

        const pHash = fromBase64(inputs.phash);
        const nHash = fromBase64(inputs.nhash);
        const to = fromHex(inputs.to);
        // TODO: Add amount to typings.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const amountIn = (inputs as any).amount;
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

        const completedTransaction: ResponseQueryTx = {
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

        this.transactions.set(
            completedTransaction.tx.hash,
            completedTransaction,
        );

        // TODO: Fix type.
        return {} as ResponseSubmitTx;
    };

    public handle_queryTx = (request: ParamsQueryTx): ResponseQueryTx => {
        const tx = this.transactions.get(request.txHash);
        if (tx) {
            return tx;
        } else {
            throw new Error(`Transaction ${request.txHash} not found.`);
        }
    };

    public handle_queryConfig = (
        _request: ParamsQueryConfig,
    ): ResponseQueryConfig => {
        return {
            confirmations: this.supportedChains.reduce(
                (acc, chain) => ({ ...acc, [chain]: 0 }),
                {},
            ),
            whitelist: [],
        };
    };

    public handle_queryBlockState = (
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
                        // @ts-expect-error list not in pack type yet
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
                        // @ts-expect-error list not in pack type yet
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
                                    // @ts-expect-error list not in pack type yet
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
                                    // @ts-expect-error list not in pack type yet
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
                                    // @ts-expect-error list not in pack type yet
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

        const v = OrderedMap(this.supportedAssets.map((x) => [x, x]))
            .map(
                () =>
                    ({
                        dustAmount: "546",
                        fees: {
                            chains: this.supportedChains.map((chain) => [
                                {
                                    chain: chain,
                                    burnFee: "15",
                                    mintFee: "15",
                                },
                            ]),
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
                    struct: this.supportedAssets.map((x) => ({
                        [x]: assetPackType,
                    })),
                },
                v,
            },
        };
    };
}
