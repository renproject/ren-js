import { Buffer } from "buffer";

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
} from "@renproject/provider/methods";
import {
    BlockState,
    ParamsQueryBlockState,
    ResponseQueryBlockState,
} from "@renproject/provider/methods/ren_queryBlockState";
import { Provider } from "@renproject/provider/rpc/jsonRpc";
import {
    Chain,
    decodeRenVMSelector,
    EMPTY_SIGNATURE,
    generateSHash,
    generateSighash,
    isDepositChain,
    pack,
    PackPrimitive,
    PackStructType,
    PackTypeDefinition,
    TxStatus,
    TypedPackValue,
    UrlBase64String,
    utils,
} from "@renproject/utils";
import BigNumber from "bignumber.js";
import elliptic from "elliptic";
import { ecsign, privateToAddress } from "ethereumjs-util";
import { OrderedMap } from "immutable";

import { MockChain } from "./MockChain";
import { randomBytes } from "./utils";

const BIP_DENOMINATOR = 10000;

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
    public privateKey: Uint8Array | undefined;
    public gPubKey: Uint8Array;

    private transactions: Map<string, ResponseQueryTx>;

    // Map from chain name to chain class
    private supportedChains = OrderedMap<string, Chain>();
    // Map from asset name to chain name
    private supportedAssets = OrderedMap<string, string>();

    public constructor({
        privateKey,
        gPubKey,
    }: {
        privateKey?: Uint8Array;
        gPubKey?: UrlBase64String | Uint8Array;
    } = {}) {
        if (gPubKey) {
            this.gPubKey =
                gPubKey instanceof Uint8Array
                    ? gPubKey
                    : utils.fromBase64(gPubKey);
            this.privateKey = privateKey;
        } else {
            this.privateKey = privateKey || randomBytes(32);
            const ec = new elliptic.ec("secp256k1");
            const k = ec.keyFromPrivate(this.privateKey);
            this.gPubKey = utils.concat([
                new Uint8Array([3]),
                utils.toNBytes(k.getPublic().getX().toString(), 32, "be"),
            ]);
        }
        this.transactions = new Map();
    }

    public mintAuthority = (): string => {
        if (!this.privateKey) {
            throw new Error(
                `Can't calculate mintAuthority when a gPubKey is provided.`,
            );
        }
        return utils.Ox(privateToAddress(Buffer.from(this.privateKey)));
    };

    public updatePrivateKey = (privateKey?: Uint8Array): this => {
        this.privateKey = privateKey || randomBytes(32);
        return this;
    };

    public registerChain = (chain: Chain, assets?: string[]): this => {
        this.supportedChains = this.supportedChains.set(chain.chain, chain);
        for (const asset of [
            ...Object.values(chain.assets),
            ...(assets || []),
        ]) {
            this.registerAsset(asset, chain);
        }
        return this;
    };

    public registerAsset = (asset: string, chain: Chain): this => {
        this.supportedAssets = this.supportedAssets.set(asset, chain.chain);
        return this;
    };

    public async sendMessage<Method extends keyof RPCParams & string>(
        method: Method,
        request: RPCParams[Method],
    ): Promise<RPCResponses[Method]> {
        try {
            switch (method) {
                case RPCMethod.SubmitTx:
                    return (await this.handle_submitTx(
                        request as ParamsSubmitTx<
                            TransactionInput<CrossChainParams>
                        >,
                    )) as RPCResponses[Method];
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
                        request as ParamsQueryBlockState,
                    ) as RPCResponses[Method];
                case RPCMethod.SubmitGateway:
                    return {} as RPCResponses[Method];
            }
            throw new Error(`Method ${method} not supported.`);
        } catch (error: unknown) {
            throw error;
        }
    }

    private handle_submitTx = async (
        request: ParamsSubmitTx<TransactionInput<CrossChainParams>>,
    ): Promise<ResponseSubmitTx> => {
        const selector = request.tx.selector;
        const asset = selector.split("/")[0];

        const assetChainName = this.supportedAssets.get(asset);
        // if (!assetChainName) {
        //     throw new Error(`Must call 'registerAsset' for '${asset}'.`);
        // }
        // const assetChain = this.supportedChains.get(assetChainName);
        // if (!assetChain) {
        //     throw new Error(
        //         `Must call 'registerChain' for '${assetChainName}'.`,
        //     );
        // }
        // return assetChain;

        const inputs = request.tx.in.v;

        const pHash = utils.fromBase64(inputs.phash);
        const nHash = utils.fromBase64(inputs.nhash);
        const to = utils.fromHex(inputs.to);

        const chains = decodeRenVMSelector(selector, assetChainName || "");
        const fromChain = this.supportedChains.get(chains.from);
        const toChain = this.supportedChains.get(chains.to);
        if (!fromChain) {
            throw new Error(
                `Must call 'registerChain' for ${String(
                    chains.from || assetChainName || "",
                )}`,
            );
        }
        if (!toChain) {
            throw new Error(
                `Must call 'registerChain' for ${String(
                    chains.to || assetChainName || "",
                )}`,
            );
        }

        const blockState: BlockState = pack.unmarshal.unmarshalTypedPackValue(
            this.handle_queryBlockState({ contract: asset }).state,
        );
        const { gasLimit, gasCap, dustAmount } = blockState[asset];

        const mintAndBurnFees = blockState[asset].fees.chains.filter(
            (chainFees) => chainFees.chain === toChain.chain,
        )[0];

        const subtractTransferFee =
            (isDepositChain(fromChain) &&
                (await fromChain.isDepositAsset(asset))) ||
            (isDepositChain(toChain) && (await toChain.isDepositAsset(asset)));

        const transferFee = subtractTransferFee
            ? gasLimit.times(gasCap).plus(dustAmount).plus(1)
            : new BigNumber(0);

        const mintFee =
            mintAndBurnFees && mintAndBurnFees.mintFee
                ? mintAndBurnFees.mintFee.toNumber()
                : 15;
        const burnFee =
            mintAndBurnFees && mintAndBurnFees.burnFee
                ? mintAndBurnFees.burnFee.toNumber()
                : 15;

        const transferRequired =
            isDepositChain(toChain) && (await toChain.isDepositAsset(asset));

        let completedTransaction: ResponseQueryTx;
        if (transferRequired) {
            // BURN //

            const amountIn = inputs.amount;
            const amountOut = new BigNumber(amountIn)
                .times(BIP_DENOMINATOR - burnFee)
                .dividedBy(BIP_DENOMINATOR)
                .minus(transferFee)
                .decimalPlaces(0)
                .toFixed();

            let txid = request.tx.in.v.txid;
            let txindex = request.tx.in.v.txindex;

            const chainName = this.supportedAssets.get(asset);
            if (chainName) {
                const chain = this.supportedChains.get(chainName);
                if ((chain as MockChain).addUTXO) {
                    const utxo = (chain as MockChain).addUTXO(
                        request.tx.in.v.to,
                        new BigNumber(amountOut),
                    );
                    txid = utils.toURLBase64(
                        utils.fromHex(utxo.txid).reverse(),
                    );
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
                            sig: EMPTY_SIGNATURE,
                            sighash: "",
                            txid,
                            txindex,
                        },
                    },
                },
            };
        } else {
            // MINT //

            if (!this.privateKey) {
                throw new Error(
                    `Can't generate signature when a gPubKey is provided.`,
                );
            }

            const amountIn = inputs.amount;
            const sHash = generateSHash(`${asset}/to${toChain.chain}`);

            const amountOut = new BigNumber(amountIn)
                .minus(transferFee)
                .times(BIP_DENOMINATOR - mintFee)
                .dividedBy(BIP_DENOMINATOR)
                .decimalPlaces(0);

            // Generate signature
            const sigHash = generateSighash(pHash, amountOut, to, sHash, nHash);
            const sig = ecsign(
                Buffer.from(sigHash),
                Buffer.from(this.privateKey),
            );
            const sigOut = utils.toURLBase64(
                utils.concat([sig.r, sig.s, new Uint8Array([sig.v])]),
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
                            amount: amountOut.toFixed(),
                            hash: request.tx.hash,
                            revert: undefined,
                            sig: sigOut,
                            sighash: utils.toURLBase64(sigHash),
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
    ): ResponseQueryConfig => {
        const whitelist: string[] = [];
        for (const asset of this.supportedAssets.keys()) {
            // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
            const originChain = this.supportedAssets.get(asset) as string;
            for (const fromChain of this.supportedChains.keys()) {
                for (const toChain of this.supportedChains.keys()) {
                    if (fromChain === toChain) {
                        continue;
                    }

                    let selector: string;
                    if (fromChain === originChain) {
                        selector = `${String(asset)}/to${String(toChain)}`;
                    } else if (toChain === originChain) {
                        selector = `${String(asset)}/from${String(fromChain)}`;
                    } else {
                        selector = `${String(asset)}/from${String(
                            fromChain,
                        )}_to${String(toChain)}`;
                    }
                    whitelist.push(selector);
                }
            }
        }

        return {
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
            whitelist,
        };
    };

    private handle_queryBlockState = ({
        contract,
    }: ParamsQueryBlockState): ResponseQueryBlockState => {
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

        const v: ResponseQueryBlockState["state"]["v"] = {
            [contract]: {
                dustAmount: "546",
                fees: {
                    chains: this.supportedChains
                        .map((chain) => ({
                            chain: chain.chain,
                            burnFee: "10",
                            mintFee: "20",
                            burnAndMintFee: "5",
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
                },
                gasCap: "2",
                gasLimit: "400",
                gasPrice: "2",
                latestHeight: "0",
                minimumAmount: "547",
                minted: [],
                shards: [
                    {
                        pubKey: utils.toURLBase64(this.gPubKey),
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
            },
        };

        return {
            state: {
                t: {
                    struct: [
                        {
                            [contract]: assetPackType,
                        },
                    ],
                },
                v,
            },
        };
    };
}
