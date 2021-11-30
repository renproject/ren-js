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
    eventEmitter,
    EventEmitterTyped,
    isDefined,
    isErrorWithCode,
    newPromiEvent,
    PromiEvent,
    TxSubmitter,
} from "@renproject/utils";

import { AbiItem } from "./abi";
import { txHashToChainTransaction } from "./generic";
import {
    EVMParamValues,
    EVMPayload,
    PayloadHandler,
} from "./payloads/evmPayloadHandlers";
import { EvmNetworkConfig } from "./types";

/** Fix numeric values in the transaction config. */
export const fixEvmTransactionConfig = (
    ...txConfigs: Array<PayableOverrides | undefined>
): PayableOverrides => {
    let result: PayableOverrides = {};
    for (const txConfig of txConfigs) {
        result = {
            ...result,
            ...txConfig,
        };
        if (isDefined(result.value)) {
            result.value = result.value.toString();
        }
        if (isDefined(result.gasPrice)) {
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
        fixEvmTransactionConfig(txConfig),
    );
};

/**
 * EVMTxSubmitter handles submitting and waiting for EVM transactions.
 */
export class EVMTxSubmitter implements TxSubmitter {
    public chain: string;
    public status: ChainTransactionProgress;
    public eventEmitter: EventEmitterTyped<{
        status: [ChainTransactionProgress];
    }>;

    private network: EvmNetworkConfig;
    private signer: Signer;
    private payload: EVMPayload;
    private target: number;
    private tx?: TransactionResponse;
    private getPayloadHandler: (payloadType: string) => PayloadHandler;
    private getParams: () => EVMParamValues;
    private onReceipt?: (tx: TransactionReceipt) => void;
    public findExistingTransaction?: () => Promise<
        ChainTransaction | undefined
    >;

    private updateStatus(status: Partial<ChainTransactionProgress>) {
        this.status = {
            ...this.status,
            ...status,
        };
        this.eventEmitter.emit("status", this.status);
        return this.status;
    }

    public constructor({
        network,
        signer,
        chain,
        payload,
        target,
        getPayloadHandler,
        getParams,
        onReceipt,
        findExistingTransaction,
    }: {
        network: EvmNetworkConfig;
        signer: Signer;
        chain: string;
        payload: EVMPayload;
        target: number;
        getPayloadHandler: (payloadType: string) => PayloadHandler;
        getParams: () => EVMParamValues;
        onReceipt?: (tx: TransactionReceipt) => void;
        findExistingTransaction?: () => Promise<ChainTransaction | undefined>;
    }) {
        this.network = network;
        this.signer = signer;
        this.chain = chain;
        this.payload = payload;
        this.target = target;
        this.getPayloadHandler = getPayloadHandler;
        this.getParams = getParams;
        this.onReceipt = onReceipt;
        this.findExistingTransaction = findExistingTransaction;

        this.eventEmitter = eventEmitter();

        this.status = {
            chain,
            status: ChainTransactionStatus.Ready,
            confirmations: 0,
            target: 0,
        };
    }

    public submit(
        options: {
            overrides?: any[];
            txConfig?: PayableOverrides;
        } = {},
    ): PromiEvent<
        ChainTransactionProgress,
        {
            status: [ChainTransactionProgress];
        }
    > {
        const promiEvent = newPromiEvent<
            ChainTransactionProgress,
            {
                status: [ChainTransactionProgress];
            }
        >(this.eventEmitter);

        (async (): Promise<ChainTransactionProgress> => {
            if (this.findExistingTransaction && this.signer.provider) {
                const existingTransaction =
                    await this.findExistingTransaction();

                if (existingTransaction) {
                    if (existingTransaction.txidFormatted === "") {
                        this.updateStatus({
                            status: ChainTransactionStatus.Done,
                            target: this.target,
                            confirmations: this.target,
                        });
                        return this.status;
                    }
                    this.tx = await this.signer.provider.getTransaction(
                        existingTransaction.txidFormatted,
                    );
                }
            }

            this.tx = await this.getPayloadHandler(this.payload.type).submit(
                this.network,
                this.signer,
                this.payload,
                this.getParams(),
                options,
                this.getPayloadHandler,
            );

            this.updateStatus({
                status: ChainTransactionStatus.Confirming,
                transaction: txHashToChainTransaction(this.chain, this.tx.hash),
                target: this.target,
                confirmations: this.tx.confirmations,
            });

            return this.status;
        })()
            .then(promiEvent.resolve)
            .catch(promiEvent.reject);

        return promiEvent;
    }

    public wait(target?: number): PromiEvent<
        ChainTransactionProgress,
        {
            status: [ChainTransactionProgress];
        }
    > {
        const promiEvent = newPromiEvent<
            ChainTransactionProgress,
            {
                status: [ChainTransactionProgress];
            }
        >(this.eventEmitter);

        (async (): Promise<ChainTransactionProgress> => {
            if (this.status.status === ChainTransactionStatus.Ready) {
                throw new Error(`Must call ".submit" first.`);
            }

            target = isDefined(target) ? target : this.target;

            // Wait for each confirmation until the target is reached.
            while (
                this.tx &&
                (this.tx.confirmations < target || this.onReceipt)
            ) {
                try {
                    const receipt = await this.tx.wait(
                        Math.min(this.tx.confirmations + 1, target),
                    );
                    if (this.onReceipt) {
                        const onReceipt = this.onReceipt;
                        this.onReceipt = undefined;
                        onReceipt(receipt);
                    }
                    const existingConfirmations = this.tx.confirmations;
                    this.tx.confirmations = receipt.confirmations;

                    if (receipt.confirmations > existingConfirmations) {
                        this.updateStatus({
                            ...this.status,
                            status:
                                this.tx.confirmations < this.target
                                    ? ChainTransactionStatus.Confirming
                                    : ChainTransactionStatus.Done,
                            transaction: txHashToChainTransaction(
                                this.chain,
                                this.tx.hash,
                            ),
                            target: this.target,
                            confirmations: this.tx.confirmations,
                        });
                    }
                } catch (error) {
                    if (isErrorWithCode(error)) {
                        if (error.code === Logger.errors.TRANSACTION_REPLACED) {
                            // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion,@typescript-eslint/no-explicit-any
                            const replacement = (error as any)
                                .replacement as TransactionResponse;
                            const previousTx = this.tx;
                            this.tx = replacement;

                            this.updateStatus({
                                status: ChainTransactionStatus.Confirming,
                                transaction: txHashToChainTransaction(
                                    this.chain,
                                    replacement.hash,
                                ),
                                target: target,
                                confirmations: replacement.confirmations,

                                replaced: txHashToChainTransaction(
                                    this.chain,
                                    previousTx.hash,
                                ),
                            });

                            continue;
                        } else if (
                            error.code === Logger.errors.CALL_EXCEPTION
                        ) {
                            this.updateStatus({
                                status: ChainTransactionStatus.Reverted,
                                transaction: txHashToChainTransaction(
                                    this.chain,
                                    this.tx.hash,
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
                this.status.status !== ChainTransactionStatus.Done &&
                this.tx &&
                this.tx.confirmations >= this.target
            ) {
                this.updateStatus({
                    status: ChainTransactionStatus.Done,
                });
            }

            return this.status;
        })()
            .then(promiEvent.resolve)
            .catch(promiEvent.reject);

        return promiEvent;
    }
}
