import { Contract, PayableOverrides, Signer } from "ethers";
import { Logger } from "ethers/lib/utils";

import {
    TransactionReceipt,
    TransactionResponse,
} from "@ethersproject/providers";
import {
    ChainTransaction,
    ChainTransactionProgress,
    ChainTransactionStatus,
    isDefined,
    isErrorWithCode,
    newPromiEvent,
    PromiEvent,
    TxSubmitter,
} from "@renproject/utils";

import { AbiItem } from "./abi";
import { txHashToChainTransaction } from "./generic";

/** Fix numeric values in the transaction config. */
export const fixEvmTransactionConfig = (txConfig?: PayableOverrides) => ({
    ...txConfig,
    ...{
        value:
            txConfig && txConfig.value ? txConfig.value.toString() : undefined,
        gasPrice:
            txConfig && txConfig.gasPrice
                ? txConfig.gasPrice.toString()
                : undefined,
    },
    // gasLimit: 2000000,
});

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
        fixEvmTransactionConfig(txConfig),
    );
};

/**
 * EVMTxSubmitter handles submitting and waiting for EVM transactions.
 */
export class EVMTxSubmitter implements TxSubmitter {
    public chain: string;
    public status: ChainTransactionProgress = {
        status: ChainTransactionStatus.Ready,
        confirmations: 0,
        target: 0,
    };

    private getTx: (options?: {
        overrides?: any[];
        txConfig?: PayableOverrides;
    }) => Promise<TransactionResponse>;
    private target: number;
    private tx?: TransactionResponse;
    private previousTx?: TransactionResponse;
    private onReceipt?: (tx: TransactionReceipt) => void;

    /**
     * @param getTx An async function that returns the initial
     * TransactionResponse.
     * @param target The number of confirmations to wait for.
     */
    constructor({
        chain,
        getTx,
        target,
        onReceipt,
    }: {
        chain: string;
        getTx: (...overrides: any[]) => Promise<TransactionResponse>;
        target: number;
        onReceipt?: (tx: TransactionReceipt) => void;
    }) {
        this.chain = chain;
        this.getTx = getTx;
        this.target = target;
        this.onReceipt = onReceipt;
    }

    submit = (options?: {
        overrides?: any[];
        txConfig?: PayableOverrides;
    }): PromiEvent<
        ChainTransaction,
        {
            status: [ChainTransactionProgress];
        }
    > => {
        const promiEvent = newPromiEvent<
            ChainTransaction,
            {
                status: [ChainTransactionProgress];
            }
        >();

        (async (): Promise<ChainTransaction> => {
            this.tx = await this.getTx(options);

            this.status = {
                ...this.status,
                status: ChainTransactionStatus.Confirming,
                transaction: txHashToChainTransaction(this.tx.hash),
                target: this.target,
                confirmations: this.tx.confirmations,
            };

            if (this.onReceipt) {
                this.tx
                    .wait()
                    .then((receipt) => {
                        if (this.onReceipt) {
                            const onReceipt = this.onReceipt;
                            this.onReceipt = undefined;
                            onReceipt(receipt);
                        }
                    })
                    .catch(() => {
                        /* ignore */
                    });
            }

            promiEvent.emit("status", this.status);

            return txHashToChainTransaction(this.tx.hash);
        })()
            .then(promiEvent.resolve)
            .catch(promiEvent.reject);

        return promiEvent;
    };

    wait = (
        target?: number,
    ): PromiEvent<
        ChainTransaction,
        {
            status: [ChainTransactionProgress];
        }
    > => {
        const promiEvent = newPromiEvent<
            ChainTransaction,
            {
                status: [ChainTransactionProgress];
            }
        >();

        (async (): Promise<ChainTransaction> => {
            if (!this.tx) {
                throw new Error(`Must call ".submit" first.`);
            }

            target = isDefined(target) ? target : this.target;

            if (target === 0) {
                return txHashToChainTransaction(this.tx.hash);
            }

            // Wait for each confirmation until the target is reached.
            while (this.tx.confirmations < target) {
                try {
                    const receipt = await this.tx.wait(
                        this.tx.confirmations + 1,
                    );
                    if (this.onReceipt) {
                        const onReceipt = this.onReceipt;
                        this.onReceipt = undefined;
                        onReceipt(receipt);
                    }
                    this.tx.confirmations = receipt.confirmations;
                } catch (error) {
                    if (isErrorWithCode(error)) {
                        if (error.code === Logger.errors.TRANSACTION_REPLACED) {
                            // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion,@typescript-eslint/no-explicit-any
                            const replacement = (error as any)
                                .replacement as TransactionResponse;
                            this.tx = replacement;

                            this.status = {
                                ...this.status,
                                status: ChainTransactionStatus.Confirming,
                                transaction: txHashToChainTransaction(
                                    replacement.hash,
                                ),
                                target: target,
                                confirmations: replacement.confirmations,
                                replaced: {
                                    previousTransaction:
                                        txHashToChainTransaction(
                                            replacement.hash,
                                        ),
                                },
                            };

                            promiEvent.emit("status", this.status);

                            continue;
                        } else if (
                            error.code === Logger.errors.CALL_EXCEPTION
                        ) {
                            this.status = {
                                ...this.status,
                                status: ChainTransactionStatus.ConfirmedWithError,
                                transaction: txHashToChainTransaction(
                                    this.tx.hash,
                                ),
                                target: target,
                                // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion,@typescript-eslint/no-explicit-any
                                confirmations: (error as any).receipt
                                    .confirmations,
                                error,
                            };

                            promiEvent.emit("status", this.status);

                            throw error;
                        }
                    }
                    console.error(error);
                    continue;
                }

                this.status = {
                    ...this.status,
                    status: ChainTransactionStatus.Confirming,
                    transaction: txHashToChainTransaction(this.tx.hash),
                    target: target,
                    confirmations: this.tx.confirmations,
                };

                promiEvent.emit("status", this.status);
            }

            return txHashToChainTransaction(this.tx.hash);
        })()
            .then(promiEvent.resolve)
            .catch(promiEvent.reject);

        return promiEvent;
    };
}
