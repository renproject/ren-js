import {
    CrossChainTxInput,
    CrossChainTxOutput,
    hashTransaction,
    PackPrimitive,
    PackTypeDefinition,
    RenVMProvider,
    ResponseQueryTx,
    TransactionInput,
    TxResponseWithStatus,
    TypedPackValue,
    UnmarshalledTxOutput,
    unmarshalTxResponse,
} from "@renproject/provider";
import {
    ChainTransactionProgress,
    ChainTransactionStatus,
    eventEmitter,
    EventEmitterTyped,
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
            ChainTransactionProgress & {
                response?: TxResponseWithStatus<
                    UnmarshalledTxOutput<
                        UnmarshalledParams,
                        UnmarshalledResponse
                    >
                >;
            }
        >
{
    public chain = "RenVM";
    private version = "1";
    private provider: RenVMProvider;
    private selector: string;
    private params: TypedPackValue;
    private hash: string;
    private signatureCallback?: (
        response: UnmarshalledTxOutput<
            UnmarshalledParams,
            UnmarshalledResponse
        >,
    ) => Promise<void>;
    public eventEmitter: EventEmitterTyped<{
        status: [
            ChainTransactionProgress & {
                response?: TxResponseWithStatus<
                    UnmarshalledTxOutput<
                        UnmarshalledParams,
                        UnmarshalledResponse
                    >
                >;
            },
        ];
    }>;

    public status: ChainTransactionProgress & {
        response?: TxResponseWithStatus<
            UnmarshalledTxOutput<UnmarshalledParams, UnmarshalledResponse>
        >;
    } = {
        chain: RENVM_CHAIN,
        status: ChainTransactionStatus.Ready,
        target: 0,
    };

    private updateStatus = (
        status: Partial<
            ChainTransactionProgress & {
                response?: TxResponseWithStatus<
                    UnmarshalledTxOutput<
                        UnmarshalledParams,
                        UnmarshalledResponse
                    >
                >;
            }
        >,
    ) => {
        this.status = {
            ...this.status,
            ...status,
        };
        this.eventEmitter.emit("status", this.status);
        return this.status;
    };

    constructor(
        provider: RenVMProvider,
        selector: string,
        params: TypedPackValue,
        signatureCallback?: (
            response: UnmarshalledTxOutput<
                UnmarshalledParams,
                UnmarshalledResponse
            >,
        ) => Promise<void>,
    ) {
        this.provider = provider;
        this.selector = selector;
        this.params = params;
        this.eventEmitter = eventEmitter();
        this.signatureCallback = signatureCallback;

        this.hash = toURLBase64(
            hashTransaction(this.version, this.selector, this.params),
        );
    }

    submit = (): PromiEvent<
        ChainTransactionProgress & {
            response?: TxResponseWithStatus<
                UnmarshalledTxOutput<UnmarshalledParams, UnmarshalledResponse>
            >;
        },
        {
            status: [
                ChainTransactionProgress & {
                    response?: TxResponseWithStatus<
                        UnmarshalledTxOutput<
                            UnmarshalledParams,
                            UnmarshalledResponse
                        >
                    >;
                },
            ];
        }
    > => {
        const promiEvent = newPromiEvent<
            ChainTransactionProgress & {
                response?: TxResponseWithStatus<
                    UnmarshalledTxOutput<
                        UnmarshalledParams,
                        UnmarshalledResponse
                    >
                >;
            },
            {
                status: [
                    ChainTransactionProgress & {
                        response?: TxResponseWithStatus<
                            UnmarshalledTxOutput<
                                UnmarshalledParams,
                                UnmarshalledResponse
                            >
                        >;
                    },
                ];
            }
        >(this.eventEmitter);

        (async (): Promise<
            ChainTransactionProgress & {
                response?: TxResponseWithStatus<
                    UnmarshalledTxOutput<
                        UnmarshalledParams,
                        UnmarshalledResponse
                    >
                >;
            }
        > => {
            const tx: TransactionInput<TypedPackValue> = {
                hash: this.hash,
                selector: this.selector,
                version: this.version,
                in: this.params,
            };

            try {
                await this.provider.submitTx(tx);
            } catch (error) {
                try {
                    // Check if the darknodes have already seen the transaction
                    await this.provider.queryTx(this.hash);

                    // TODO: Set status based on result.

                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                } catch (errorInner: any) {
                    // Retry submitting to reduce chance of network issues
                    // causing problems.
                    await this.provider.submitTx(tx, 2);
                }
            }

            return this.updateStatus({
                status: ChainTransactionStatus.Confirming,
            });

            // const response = {
            //     version: parseInt(tx.version),
            //     hash: tx.hash,
            //     selector: tx.selector,
            //     in: unmarshalTypedPackValue(tx.in),
            // };
        })()
            .then(promiEvent.resolve)
            .catch(promiEvent.reject);

        return promiEvent;
    };

    wait = (): PromiEvent<
        ChainTransactionProgress & {
            response?: TxResponseWithStatus<
                UnmarshalledTxOutput<UnmarshalledParams, UnmarshalledResponse>
            >;
        },
        {
            status: [
                ChainTransactionProgress & {
                    response?: TxResponseWithStatus<
                        UnmarshalledTxOutput<
                            UnmarshalledParams,
                            UnmarshalledResponse
                        >
                    >;
                },
            ];
        }
    > => {
        const promiEvent = newPromiEvent<
            ChainTransactionProgress & {
                response?: TxResponseWithStatus<
                    UnmarshalledTxOutput<
                        UnmarshalledParams,
                        UnmarshalledResponse
                    >
                >;
            },
            {
                status: [
                    ChainTransactionProgress & {
                        response?: TxResponseWithStatus<
                            UnmarshalledTxOutput<
                                UnmarshalledParams,
                                UnmarshalledResponse
                            >
                        >;
                    },
                ];
            }
        >(this.eventEmitter);

        (async (): Promise<
            ChainTransactionProgress & {
                response?: TxResponseWithStatus<
                    UnmarshalledTxOutput<
                        UnmarshalledParams,
                        UnmarshalledResponse
                    >
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

            if (
                (tx.out as any as CrossChainTxOutput).revert &&
                (tx.out as any as CrossChainTxOutput).revert.length > 0
            ) {
                const revertMessage = (tx.out as any as CrossChainTxOutput)
                    .revert;
                this.updateStatus({
                    status: ChainTransactionStatus.Reverted,
                    revertReason: revertMessage,
                });
                throw new Error(`RenVM transaction reverted: ${revertMessage}`);
            }

            if (this.signatureCallback) {
                try {
                    await this.signatureCallback(tx);
                } catch (error) {
                    // TODO: Hande error.
                }
            }

            return this.updateStatus({
                response: {
                    tx,
                    txStatus: rawResponse.txStatus,
                },
                status: ChainTransactionStatus.Done,
                transaction: {
                    chain: RENVM_CHAIN,
                    txid: this.hash,
                    txidFormatted: this.hash,
                    txindex: "0",
                },
            });
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
        signatureCallback?: (
            response: UnmarshalledTxOutput<
                CrossChainTxInput,
                CrossChainTxOutput
            >,
        ) => Promise<void>,
    ) {
        super(
            provider,
            selector,
            {
                t: crossChainParamsType,
                v: {
                    txid: toURLBase64(params.txid),
                    txindex: params.txindex.toFixed(),
                    amount: params.amount.toFixed(),
                    payload: toURLBase64(params.payload),
                    phash: toURLBase64(params.phash),
                    to: params.to,
                    nonce: toURLBase64(params.nonce),
                    nhash: toURLBase64(params.nhash),
                    gpubkey: toURLBase64(params.gpubkey),
                    ghash: toURLBase64(params.ghash),
                },
            },
            signatureCallback,
        );
    }
}
