import base58 from "bs58";

import {
    ChainTransaction,
    ChainTransactionProgress,
    ChainTransactionStatus,
    eventEmitter,
    EventEmitterTyped,
    PromiEvent,
    TxSubmitter,
    utils,
} from "@renproject/utils";
import {
    Connection,
    sendAndConfirmRawTransaction,
    Transaction,
} from "@solana/web3.js";

import { SolanaSigner } from "./types/types";

export class SolanaTxWaiter implements TxSubmitter {
    private _getTransaction: () => Promise<Transaction>;
    private _provider: Connection;
    private _getSigner: () => SolanaSigner | undefined;
    private _onReceipt?: (signature: string) => void;
    private _findExistingTransaction?: () => Promise<
        ChainTransaction | undefined
    >;

    public chain: string;
    public status: ChainTransactionProgress;
    public eventEmitter: EventEmitterTyped<{
        status: [ChainTransactionProgress];
    }>;

    private updateStatus(status: Partial<ChainTransactionProgress>) {
        this.status = {
            ...this.status,
            ...status,
        };
        this.eventEmitter.emit("status", this.status);
    }

    /**
     * Requires a submitted chainTransaction, a chain object and the target
     * confirmation count.
     */
    public constructor({
        chain,
        target,
        provider,
        getSigner,
        getTransaction,
        onReceipt,
        findExistingTransaction,
    }: {
        chain: string;
        target: number;
        provider: Connection;
        getSigner: () => SolanaSigner | undefined;
        getTransaction: () => Promise<Transaction>;
        onReceipt?: (signature: string) => void;
        findExistingTransaction?: () => Promise<ChainTransaction | undefined>;
    }) {
        this._getTransaction = getTransaction;
        this.chain = chain;
        this._provider = provider;
        this._getSigner = getSigner;
        this._onReceipt = onReceipt;
        this._findExistingTransaction = findExistingTransaction;

        this.eventEmitter = eventEmitter();

        this.status = {
            chain,
            target,
            status: ChainTransactionStatus.Ready,
        };
    }

    public submit(): PromiEvent<
        ChainTransactionProgress,
        {
            status: [ChainTransactionProgress];
        }
    > {
        const promiEvent = utils.newPromiEvent<
            ChainTransactionProgress,
            {
                status: [ChainTransactionProgress];
            }
        >(this.eventEmitter);

        (async (): Promise<ChainTransactionProgress> => {
            if (this._findExistingTransaction && this._provider) {
                const existingTransaction =
                    await this._findExistingTransaction();

                if (existingTransaction) {
                    this.updateStatus({
                        status: ChainTransactionStatus.Done,
                        confirmations: this.status.target,
                        target: this.status.target,
                        transaction: existingTransaction,
                    });
                    return this.status;
                }
            }

            const tx = await this._getTransaction();

            // sendAndConfirmRawTransaction already calls simulate.
            // const simulationResult = await utils.tryNTimes(
            //     async () => this._provider.simulateTransaction(tx),
            //     5,
            // );
            // if (simulationResult.value.err) {
            //     throw new Error(
            //         "transaction simulation failed: " +
            //             JSON.stringify(simulationResult),
            //     );
            // }

            const signer = await this._getSigner();
            if (!signer) {
                throw new Error(`Must connect ${this.chain} signer.`);
            }
            const signed = await signer.signTransaction(tx);
            if (!signed.signature) {
                throw new Error("failed to sign");
            }

            // Should be the same as `signature`.
            const confirmedSignature = await sendAndConfirmRawTransaction(
                this._provider,
                signed.serialize(),
                { commitment: "confirmed" },
            );

            if (this._onReceipt) {
                this._onReceipt(confirmedSignature);
            }

            this.updateStatus({
                status: ChainTransactionStatus.Confirming,
                transaction: {
                    chain: this.status.chain,
                    txidFormatted: confirmedSignature,
                    txid: utils.toURLBase64(base58.decode(confirmedSignature)),
                    txindex: "0",
                },
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
        const promiEvent = utils.newPromiEvent<
            ChainTransactionProgress,
            {
                status: [ChainTransactionProgress];
            }
        >(this.eventEmitter);

        (async (): Promise<ChainTransactionProgress> => {
            if (!this.status.transaction) {
                throw new Error(`Must call ".submit" first.`);
            }

            if (
                this.status.transaction.txid === "" &&
                this.status.status === ChainTransactionStatus.Done
            ) {
                return this.status;
            }

            target = utils.isDefined(target) ? target : this.status.target;

            let currentConfidenceRatio = -1;
            while (true) {
                const tx = await this._provider.getConfirmedTransaction(
                    this.status.transaction.txidFormatted,
                );

                const currentSlot = await this._provider.getSlot();
                const confidence = currentSlot - (tx && tx.slot ? tx.slot : 0);

                const confidenceRatio = target === 0 ? 1 : confidence / target;

                // The confidence has increased.
                if (confidenceRatio > currentConfidenceRatio) {
                    if (confidenceRatio >= 1) {
                        // Done.
                        this.updateStatus({
                            ...this.status,
                            confirmations: confidence,
                            status: ChainTransactionStatus.Done,
                        });
                        break;
                    } else {
                        // Update status.
                        currentConfidenceRatio = confidenceRatio;
                        this.updateStatus({
                            ...this.status,
                            confirmations: confidence,
                        });
                    }
                }
                await utils.sleep(15 * utils.sleep.SECONDS);
            }

            return this.status;
        })()
            .then(promiEvent.resolve)
            .catch(promiEvent.reject);

        return promiEvent;
    }
}
