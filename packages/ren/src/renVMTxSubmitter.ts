import {
    CrossChainTxInput,
    CrossChainTxOutput,
    hashTransaction,
    PackPrimitive,
    PackTypeDefinition,
    RenVMProvider,
    ResponseQueryTx,
    TransactionInput,
    TypedPackValue,
    UnmarshalledTxInput,
    UnmarshalledTxOutput,
    unmarshalTxResponse,
    unmarshalTypedPackValue,
} from "@renproject/provider";
import {
    ChainTransaction,
    ChainTransactionProgress,
    ChainTransactionStatus,
    newPromiEvent,
    PromiEvent,
    SECONDS,
    sleep,
    toURLBase64,
    TxStatus,
    TxSubmitter,
} from "@renproject/utils";

export const RENVM_CHAIN = "RenVM";

class RenVMTxSubmitter<UnmarshalledParams, UnmarshalledResponse>
    implements
        TxSubmitter<
            ChainTransaction & {
                tx: UnmarshalledTxInput<UnmarshalledParams>;
            },
            ChainTransaction & {
                tx: UnmarshalledTxOutput<
                    UnmarshalledParams,
                    UnmarshalledResponse
                >;
            }
        >
{
    public chain = "RenVM";
    public version = "1";
    public provider: RenVMProvider;
    public selector: string;
    public params: TypedPackValue;
    public hash: string;

    public status: ChainTransactionProgress = {
        chain: RENVM_CHAIN,
        status: ChainTransactionStatus.Ready,
        target: 0,
    };

    constructor(
        provider: RenVMProvider,
        selector: string,
        params: TypedPackValue,
    ) {
        this.provider = provider;
        this.selector = selector;
        this.params = params;

        this.hash = toURLBase64(
            hashTransaction(this.version, this.selector, this.params),
        );
    }

    submit = (): PromiEvent<
        ChainTransaction & { tx: UnmarshalledTxInput<UnmarshalledParams> },
        {
            status: [ChainTransactionProgress];
        }
    > => {
        const promiEvent = newPromiEvent<
            ChainTransaction & {
                tx: UnmarshalledTxInput<UnmarshalledParams>;
            },
            {
                status: [ChainTransactionProgress];
            }
        >();

        (async (): Promise<
            ChainTransaction & {
                tx: UnmarshalledTxInput<UnmarshalledParams>;
            }
        > => {
            const hash = toURLBase64(
                hashTransaction(this.version, this.selector, this.params),
            );

            const tx: TransactionInput<TypedPackValue> = {
                hash,
                selector: this.selector,
                version: this.version,
                in: this.params,
            };

            try {
                await this.provider.submitTx(tx);
            } catch (error) {
                try {
                    // Check if the darknodes have already seen the transaction
                    await this.provider.queryTx(hash);

                    // TODO: Set status based on result.

                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                } catch (errorInner: any) {
                    // Retry submitting to reduce chance of network issues
                    // causing problems.
                    await this.provider.submitTx(tx, 2);
                }
            }

            const unmarshalledTx = {
                version: parseInt(tx.version),
                hash: tx.hash,
                selector: tx.selector,
                in: unmarshalTypedPackValue(tx.in),
            };

            return {
                chain: RENVM_CHAIN,
                txid: hash,
                txindex: "0",
                tx: unmarshalledTx,
            };
        })()
            .then(promiEvent.resolve)
            .catch(promiEvent.reject);

        return promiEvent;
    };

    wait = (): PromiEvent<
        ChainTransaction & {
            tx: UnmarshalledTxOutput<UnmarshalledParams, UnmarshalledResponse>;
        },
        {
            status: [ChainTransactionProgress];
        }
    > => {
        const promiEvent = newPromiEvent<
            ChainTransaction & {
                tx: UnmarshalledTxOutput<
                    UnmarshalledParams,
                    UnmarshalledResponse
                >;
            },
            {
                status: [ChainTransactionProgress];
            }
        >();

        (async (): Promise<
            ChainTransaction & {
                tx: UnmarshalledTxOutput<
                    UnmarshalledParams,
                    UnmarshalledResponse
                >;
            }
        > => {
            let rawResponse: ResponseQueryTx;
            while (true) {
                try {
                    const result = await this.provider.queryTx(this.hash);
                    if (result && result.txStatus === TxStatus.TxStatusDone) {
                        rawResponse = result;
                        break;
                        // } else if (onStatus && result && result.txStatus) {
                        //     onStatus(result.txStatus);
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
                        // TODO: throw unexpected errors
                    }
                }
                await sleep(15 * SECONDS);
            }
            const tx = unmarshalTxResponse<
                UnmarshalledParams,
                UnmarshalledResponse
            >(rawResponse.tx);

            return {
                chain: RENVM_CHAIN,
                txid: this.hash,
                txindex: "0",
                tx: tx,
            };
        })()
            .then(promiEvent.resolve)
            .catch(promiEvent.reject);

        return promiEvent;
    };
}

export const crossChainParamsType: PackTypeDefinition = {
    struct: [
        {
            txid: PackPrimitive.Bytes,
        },
        {
            txindex: PackPrimitive.U32,
        },
        {
            amount: PackPrimitive.U256,
        },
        {
            payload: PackPrimitive.Bytes,
        },
        {
            phash: PackPrimitive.Bytes32,
        },
        {
            to: PackPrimitive.Str,
        },
        {
            nonce: PackPrimitive.Bytes32,
        },
        {
            nhash: PackPrimitive.Bytes32,
        },
        {
            gpubkey: PackPrimitive.Bytes,
        },
        {
            ghash: PackPrimitive.Bytes32,
        },
    ],
};

export class RenVMCrossChainTxSubmitter extends RenVMTxSubmitter<
    CrossChainTxInput,
    CrossChainTxOutput
> {
    constructor(
        provider: RenVMProvider,
        selector: string,
        params: CrossChainTxInput,
    ) {
        super(provider, selector, {
            t: crossChainParamsType,
            v: {
                txid: params.txid,
                txindex: params.txindex,
                amount: params.amount,
                payload:
                    typeof params.payload === "string"
                        ? params.payload
                        : toURLBase64(params.payload),
                phash:
                    typeof params.phash === "string"
                        ? params.phash
                        : toURLBase64(params.phash),
                to:
                    typeof params.to === "string"
                        ? params.to
                        : toURLBase64(params.to),
                nonce:
                    typeof params.nonce === "string"
                        ? params.nonce
                        : toURLBase64(params.nonce),
                nhash:
                    typeof params.nhash === "string"
                        ? params.nhash
                        : toURLBase64(params.nhash),
                gpubkey:
                    typeof params.gpubkey === "string"
                        ? params.gpubkey
                        : toURLBase64(params.gpubkey),
                ghash:
                    typeof params.ghash === "string"
                        ? params.ghash
                        : toURLBase64(params.ghash),
            },
        });
    }
}
