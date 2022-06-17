import {
    Provider,
    TransactionReceipt,
    TransactionResponse,
} from "@ethersproject/providers";
import {
    ChainTransaction,
    ChainTransactionProgress,
    ChainTransactionStatus,
    ErrorWithCode,
    eventEmitter,
    EventEmitterTyped,
    PromiEvent,
    RenJSError,
    TxSubmitter,
    utils,
} from "@renproject/utils";
import {
    Contract,
    ethers,
    PayableOverrides,
    PopulatedTransaction,
    Signer,
} from "ethers";
import { Logger } from "ethers/lib/utils";

import { AbiItem } from "./abi";
import { checkProviderNetwork, txHashToChainTransaction } from "./generic";
import {
    EVMParamValues,
    EVMPayloadInterface,
    PayloadHandler,
} from "./payloads/evmParams";
import { EVMNetworkConfig } from "./types";

/** Fix numeric values in the transaction config. */
export const fixEVMTransactionConfig = (
    ...txConfigs: Array<PayableOverrides | undefined>
): PayableOverrides => {
    let result: PayableOverrides = {};
    for (const txConfig of txConfigs) {
        result = {
            ...result,
            ...txConfig,
        };
        if (utils.isDefined(result.value)) {
            result.value = result.value.toString();
        }
        if (utils.isDefined(result.gasPrice)) {
            result.gasPrice = result.gasPrice.toString();
        }
    }
    return result;
};

/**
 * Call a method on an EVM contract from the provided signer.
 *
 * @param signer An Ethers signer to make the call from.
 * @param to The EVM contract's address.
 * @param abi The ABI of the method being called.
 * @param params The parameters for the method, as defined by the ABI.
 * @param txConfig Optional EVM transaction config.
 * @returns An unconfirmed transaction response.
 */
export const callContract = async (
    signer: Signer,
    to: string,
    abi: AbiItem,
    params: unknown[],
    txConfig?: PayableOverrides,
): Promise<TransactionResponse> => {
    if (!abi.name) {
        throw new Error(`ABI must include method name.`);
    }

    const contract = new Contract(to, [abi], signer);

    return await contract[abi.name](
        ...params,
        fixEVMTransactionConfig(txConfig),
    );
};

/**
 * EVMTxSubmitter handles submitting and waiting for EVM transactions.
 */
export class EVMTxSubmitter
    implements
        TxSubmitter<
            ChainTransactionProgress,
            PayableOverrides,
            PopulatedTransaction
        >
{
    public chain: string;
    public progress: ChainTransactionProgress;
    public eventEmitter: EventEmitterTyped<{
        progress: [ChainTransactionProgress];
    }>;

    private _network: EVMNetworkConfig;
    private _getProvider: () => Provider;
    private _getSigner: () => Signer | undefined;
    private _payload: EVMPayloadInterface;
    private _tx?: TransactionResponse;
    private _getPayloadHandler: (payloadType: string) => PayloadHandler;
    private _getParams: () => EVMParamValues;
    private _onReceipt?: (tx: TransactionReceipt) => void;
    private _findExistingTransaction?: () => Promise<
        ChainTransaction | undefined
    >;
    private _transactionExplorerLink?: (
        params: Partial<ChainTransaction> &
            ({ txid: string } | { txHash: string }),
    ) => string | undefined;

    private updateProgress = (
        progress: Partial<ChainTransactionProgress>,
    ): ChainTransactionProgress => {
        this.progress = {
            ...this.progress,
            ...progress,
        };
        this.eventEmitter.emit("progress", this.progress);
        return this.progress;
    };

    public constructor({
        network,
        getProvider,
        getSigner,
        chain,
        payload,
        target,
        getPayloadHandler,
        getParams,
        onReceipt,
        findExistingTransaction,
        transactionExplorerLink,
    }: {
        network: EVMNetworkConfig;
        getProvider: () => Provider;
        getSigner: () => Signer | undefined;
        chain: string;
        payload: EVMPayloadInterface;
        target: number;
        getPayloadHandler: (payloadType: string) => PayloadHandler;
        getParams: () => EVMParamValues;
        onReceipt?: (tx: TransactionReceipt) => void;
        findExistingTransaction?: () => Promise<ChainTransaction | undefined>;
        transactionExplorerLink?: (
            params: Partial<ChainTransaction> &
                ({ txid: string } | { txHash: string }),
        ) => string | undefined;
    }) {
        this._network = network;
        this._getProvider = getProvider;
        this._getSigner = getSigner;
        this.chain = chain;
        this._payload = payload;
        this._getPayloadHandler = getPayloadHandler;
        this._getParams = getParams;
        this._onReceipt = onReceipt;
        this._findExistingTransaction = findExistingTransaction;
        this._transactionExplorerLink = transactionExplorerLink;

        this.eventEmitter = eventEmitter();

        this.progress = {
            chain,
            status: ChainTransactionStatus.Ready,
            confirmations: 0,
            target: target,
        };
    }

    public export = async (
        options: {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            overrides?: { [key: string]: any };
            txConfig?: PayableOverrides;
        } = {},
    ): Promise<PopulatedTransaction> => {
        if (!this._payload.type) {
            throw new Error(`No ${this.chain} payload provided.`);
        }
        return await this._getPayloadHandler(this._payload.type).export({
            network: this._network,
            signer: this._getSigner(),
            payload: this._payload,
            evmParams: this._getParams(),
            overrides: options,
            getPayloadHandler: this._getPayloadHandler,
        });
    };

    public submit = (
        options: {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            overrides?: { [key: string]: any };
            txConfig?: PayableOverrides;
        } = {},
    ): PromiEvent<
        ChainTransactionProgress,
        {
            progress: [ChainTransactionProgress];
        }
    > => {
        const promiEvent = utils.newPromiEvent<
            ChainTransactionProgress,
            {
                progress: [ChainTransactionProgress];
            }
        >(this.eventEmitter);

        (async (): Promise<ChainTransactionProgress> => {
            if (!this._payload.type) {
                throw new Error(`No ${this.chain} payload provided.`);
            }

            const provider = this._getProvider();
            if (this._findExistingTransaction && provider) {
                const existingTransaction =
                    await this._findExistingTransaction();

                if (existingTransaction) {
                    if (existingTransaction.txHash === "") {
                        this.updateProgress({
                            status: ChainTransactionStatus.Done,
                            confirmations: this.progress.target,
                        });
                        return this.progress;
                    }
                    this._tx = await provider.getTransaction(
                        String(existingTransaction.txHash),
                    );
                }
            }

            if (!this._tx) {
                const signer = this._getSigner();
                if (!signer) {
                    throw new Error(`Must connect ${this.chain} signer.`);
                }
                if (!signer.provider) {
                    throw new Error("EVM signer has no connected provider.");
                }
                const payloadHandler = this._getPayloadHandler(
                    this._payload.type,
                );
                if (payloadHandler.required) {
                    const required = await payloadHandler.required({
                        network: this._network,
                        signer: signer,
                        payload: this._payload,
                        evmParams: this._getParams(),
                        getPayloadHandler: this._getPayloadHandler,
                    });
                    if (!required) {
                        this.updateProgress({
                            status: ChainTransactionStatus.Done,
                            confirmations: this.progress.target,
                        });
                    }
                }

                // TODO: Check if `signer.sendTransaction` will always work
                // with `from` defined.
                const { from, ...tx } = await payloadHandler.export({
                    network: this._network,
                    signer: signer,
                    payload: this._payload,
                    evmParams: this._getParams(),
                    overrides: options,
                    getPayloadHandler: this._getPayloadHandler,
                });

                if (from) {
                    const recipient = ethers.utils.getAddress(from);
                    const address = ethers.utils.getAddress(
                        await signer.getAddress(),
                    );
                    if (recipient !== address) {
                        throw new Error(
                            `Transaction can only be submitted by ${recipient} - connected address is ${address}.`,
                        );
                    }
                }

                // Check the signer's network.
                const providerNetworkCheck = await checkProviderNetwork(
                    signer.provider || provider,
                    this._network,
                );
                if (!providerNetworkCheck.result) {
                    throw new ErrorWithCode(
                        `Invalid ${this.chain} signer network: expected ${providerNetworkCheck.expectedNetworkId} (${providerNetworkCheck.expectedNetworkLabel}), got ${providerNetworkCheck.actualNetworkId}.`,
                        RenJSError.INCORRECT_PROVIDER_NETWORK,
                    );
                }

                // `populateTransaction` fills in the missing details - e.g.
                // gas details. It's commented out because it seems that it's
                // better to calculate this in the `sendTransaction` step.
                // const populatedTx = await signer.populateTransaction(tx);
                this._tx = await signer.sendTransaction(tx);
            }

            this.updateProgress({
                status:
                    this._tx.confirmations < this.progress.target
                        ? ChainTransactionStatus.Confirming
                        : ChainTransactionStatus.Done,
                transaction: txHashToChainTransaction(
                    this.chain,
                    this._tx.hash,
                    (this._transactionExplorerLink &&
                        this._transactionExplorerLink({
                            txHash: this._tx.hash,
                        })) ||
                        "",
                ),
                confirmations: this._tx.confirmations,
            });

            return this.progress;
        })()
            .then(promiEvent.resolve)
            .catch(promiEvent.reject);

        return promiEvent;
    };

    public setTransaction = async (
        chainTransaction: ChainTransaction,
    ): Promise<ChainTransactionProgress> => {
        const provider = this._getProvider();
        this._tx = await provider.getTransaction(
            String(chainTransaction.txHash),
        );
        return this.updateProgress({
            status:
                this._tx.confirmations < this.progress.target
                    ? ChainTransactionStatus.Confirming
                    : ChainTransactionStatus.Done,
            transaction: txHashToChainTransaction(
                this.chain,
                this._tx.hash,
                (this._transactionExplorerLink &&
                    this._transactionExplorerLink({
                        txHash: this._tx.hash,
                    })) ||
                    "",
            ),
            confirmations: this._tx.confirmations,
        });
    };

    public wait = (
        target?: number,
    ): PromiEvent<
        ChainTransactionProgress,
        {
            progress: [ChainTransactionProgress];
        }
    > => {
        const promiEvent = utils.newPromiEvent<
            ChainTransactionProgress,
            {
                progress: [ChainTransactionProgress];
            }
        >(this.eventEmitter);

        (async (): Promise<ChainTransactionProgress> => {
            if (this.progress.status === ChainTransactionStatus.Ready) {
                throw new Error(`Must call ".submit" first.`);
            }

            target = utils.isDefined(target) ? target : this.progress.target;

            // Wait for each confirmation until the target is reached.
            while (
                this._tx &&
                (this._tx.confirmations < target || this._onReceipt)
            ) {
                try {
                    const receipt = await this._tx.wait(
                        Math.min(this._tx.confirmations + 1, target),
                    );
                    if (this._onReceipt) {
                        const onReceipt = this._onReceipt;
                        this._onReceipt = undefined;
                        onReceipt(receipt);
                    }
                    const existingConfirmations = this._tx.confirmations;
                    this._tx.confirmations = receipt.confirmations;

                    if (receipt.confirmations > existingConfirmations) {
                        this.updateProgress({
                            ...this.progress,
                            status:
                                this._tx.confirmations < this.progress.target
                                    ? ChainTransactionStatus.Confirming
                                    : ChainTransactionStatus.Done,
                            transaction: txHashToChainTransaction(
                                this.chain,
                                this._tx.hash,
                                (this._transactionExplorerLink &&
                                    this._transactionExplorerLink({
                                        txHash: this._tx.hash,
                                    })) ||
                                    "",
                            ),
                            confirmations: this._tx.confirmations,
                        });
                    }
                } catch (error: unknown) {
                    if (ErrorWithCode.isErrorWithCode(error)) {
                        if (error.code === Logger.errors.TRANSACTION_REPLACED) {
                            // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion,@typescript-eslint/no-explicit-any
                            const replacement = (error as any)
                                .replacement as TransactionResponse;
                            const previousTx = this._tx;
                            this._tx = replacement;

                            this.updateProgress({
                                status: ChainTransactionStatus.Confirming,
                                transaction: txHashToChainTransaction(
                                    this.chain,
                                    replacement.hash,
                                    (this._transactionExplorerLink &&
                                        this._transactionExplorerLink({
                                            txHash: replacement.hash,
                                        })) ||
                                        "",
                                ),
                                target: target,
                                confirmations: replacement.confirmations,

                                replaced: txHashToChainTransaction(
                                    this.chain,
                                    previousTx.hash,
                                    (this._transactionExplorerLink &&
                                        this._transactionExplorerLink({
                                            txHash: previousTx.hash,
                                        })) ||
                                        "",
                                ),
                            });

                            continue;
                        } else if (
                            error.code === Logger.errors.CALL_EXCEPTION
                        ) {
                            this.updateProgress({
                                status: ChainTransactionStatus.Reverted,
                                transaction: txHashToChainTransaction(
                                    this.chain,
                                    this._tx.hash,
                                    (this._transactionExplorerLink &&
                                        this._transactionExplorerLink({
                                            txHash: this._tx.hash,
                                        })) ||
                                        "",
                                ),
                                target: target,
                                // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion,@typescript-eslint/no-explicit-any
                                confirmations: (error as any).receipt
                                    .confirmations,
                                revertReason: error.message,
                            });

                            throw error;
                        }
                    }
                    console.error(error);
                    continue;
                }
            }

            if (
                this.progress.status !== ChainTransactionStatus.Done &&
                this._tx &&
                this._tx.confirmations >= this.progress.target
            ) {
                this.updateProgress({
                    status: ChainTransactionStatus.Done,
                });
            }

            return this.progress;
        })()
            .then(promiEvent.resolve)
            .catch(promiEvent.reject);

        return promiEvent;
    };
}
