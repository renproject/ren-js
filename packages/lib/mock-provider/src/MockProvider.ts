import { Provider } from "@renproject/provider";
import {
    PackPrimitive,
    PackStructType,
    TypedPackValue,
} from "@renproject/rpc/build/main/v2";
import {
    ParamsQueryConfig,
    ParamsQueryState,
    ParamsQueryTx,
    ParamsSubmitTx,
    RenVMParams,
    RenVMResponses,
    ResponseQueryConfig,
    ResponseQueryState,
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
import AbiCoder from "web3-eth-abi";
import BigNumber from "bignumber.js";
import { ChainCommon, TxStatus } from "@renproject/interfaces";
import elliptic from "elliptic";

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
    private supportedChains: Array<string>;

    constructor(privateKey?: Buffer) {
        this.privateKeyBuffer = privateKey || randomBytes(32);
        this.transactions = new Map();
        this.supportedChains = [];
    }

    public mintAuthority = () =>
        Ox(privateToAddress(this.privateKeyBuffer).toString("hex"));

    public registerChain = (chain: ChainCommon) => {
        this.supportedChains.push(chain.name);
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
                case RPCMethod.QueryState:
                    return this.handle_queryState(
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
        const amountIn = (inputs as any).amount;
        const sHash = keccak256(Buffer.from(selector));

        const amountOut = new BigNumber(amountIn).minus(1000).toFixed();

        // Generate signature
        const sigParams = (
            AbiCoder as any as AbiCoder.AbiCoder
        ).encodeParameters(
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
                        revert: "",
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
        if (this.transactions.has(request.txHash)) {
            return this.transactions.get(request.txHash)!;
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

    public handle_queryState = (
        _request: ParamsQueryState,
    ): ResponseQueryState => {
        const ec = new elliptic.ec("secp256k1");
        let k = ec.keyFromPrivate(this.privateKeyBuffer);
        const key = Buffer.concat([
            Buffer.from([3]),
            k.getPublic().getX().toArrayLike(Buffer, "be", 32),
        ]);

        return {
            state: this.supportedChains.reduce(
                (acc, chain) => ({
                    ...acc,
                    [chain]: {
                        pubKey: toURLBase64(key),
                    },
                }),
                {},
            ),
        };
    };
}
