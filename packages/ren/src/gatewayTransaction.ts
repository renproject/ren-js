import { RenVMProvider } from "@renproject/provider";
import {
    CrossChainTxResponse,
    TxResponseWithStatus,
} from "@renproject/provider/build/main/unmarshal";
import {
    Chain,
    ChainTransaction,
    DefaultTxWaiter,
    fixSignatureSimple,
    fromBase64,
    InputChainTransaction,
    isContractChain,
    isDefined,
    keccak256,
    newPromiEvent,
    PromiEvent,
    RenJSErrors,
    sleep,
    toURLBase64,
    TxStatus,
    TxSubmitter,
    TxWaiter,
} from "@renproject/utils";

import { defaultRenJSConfig, RenJSConfig } from "./config";
import { waitForTX } from "./utils/providerUtils";

export enum TransactionStatus {
    FetchingStatus = "fetching-status",
    Detected = "detected",
    Confirmed = "confirmed",
    Signed = "signed",
    Reverted = "reverted",
    Submitted = "submitted",
}

export const TransactionStatusIndex = {
    [TransactionStatus.Detected]: 0,
    [TransactionStatus.Confirmed]: 1,
    [TransactionStatus.Signed]: 2,
    [TransactionStatus.Reverted]: 3,
    [TransactionStatus.Submitted]: 4,
};

export interface TransactionParams<
    ToPayload extends { chain: string } = {
        chain: string;
    },
> {
    asset: string;
    fromChain: Chain;
    toChain: Chain;

    toPayload: ToPayload;
    inputTransaction: InputChainTransaction;
    fromTxWaiter?: TxWaiter;

    selector: string;
    gPubKey: string;
    nonce: string;
    nHash: string;
    pHash: string;
    gHash: string;
}

export enum InputType {
    Lock = "lock",
    Burn = "burn",
}

export enum OutputType {
    Mint = "mint",
    Release = "release",
}

export class GatewayTransaction<
    ToPayload extends { chain: string; chainClass?: Chain } = {
        chain: string;
        chainClass?: Chain;
    },
> {
    /** The parameters passed in when calling [[RenJS.lockAndMint]]. */
    public params: TransactionParams<ToPayload>;

    /**
     * `txHash` returns the RenVM transaction hash, which is distinct from the
     * chain transaction hashes. It can be used to query the transaction details
     * from RenVM once they've been submitted.
     *
     * The RenVM txHash is a URL-base64 string.
     *
     * ```ts
     * tx.hash;
     * // > "QNM87rNDuxx54H7VK7D_NAU0u_mjk09-G25IJZL1QrI"
     * ```
     */
    public hash: string;
    public selector: string;

    /**
     * The status of the deposit, updated automatically. You can also call
     * `refreshStatus` to re-fetch this.
     *
     * ```ts
     * deposit.status;
     * // > "signed"
     * ```
     */
    public status: TransactionStatus;

    /** See [[RenJS.renVM]]. */
    public renVM: RenVMProvider;

    public outTransaction?: ChainTransaction;
    public revertReason?: string;

    public _config: typeof defaultRenJSConfig & RenJSConfig;

    public in: TxWaiter;
    public out: TxSubmitter | TxWaiter;

    // Private
    private queryTxResult:
        | TxResponseWithStatus<CrossChainTxResponse>
        | undefined;
    private _renTxSubmitted: boolean = false;

    private inputType: InputType | undefined;
    private outputType: OutputType | undefined;

    /** @hidden */
    constructor(
        renVM: RenVMProvider,
        params: TransactionParams<ToPayload>,
        config?: RenJSConfig,
    ) {
        this.renVM = renVM;
        this.params = params;
        this._config = {
            ...defaultRenJSConfig,
            ...config,
        };

        // `processDeposit` will call `refreshStatus` which will set the proper
        // status.
        this.status = TransactionStatus.FetchingStatus;

        this.selector = this.params.selector;

        // Set hash to "" rather than undefined so that it's type is always
        // `string`. The hash will be set in `_initialize` which should be
        // called immediately after the constructor.
        this.hash = "";

        if (this.params.fromTxWaiter) {
            this.in = this.params.fromTxWaiter;
        } else {
            this.in = undefined as never;
        }

        // TODO: Throw error if this.out is accessed before this.signed().
        this.out = undefined as never;
    }

    /** @hidden */
    public readonly _initialize = async (): Promise<this> => {
        if (await this.params.fromChain.assetIsNative(this.params.asset)) {
            this.inputType = InputType.Lock;
            this.outputType = OutputType.Mint;
        } else if (await this.params.toChain.assetIsNative(this.params.asset)) {
            this.inputType = InputType.Burn;
            this.outputType = OutputType.Release;
        } else {
            throw new Error(`Burning and minting is not supported yet.`);
            this.inputType = InputType.Burn;
            this.outputType = OutputType.Mint;
        }

        const {
            asset,
            toChain,
            toPayload,
            gPubKey,
            nonce,
            nHash,
            pHash,
            gHash,
            inputTransaction,
        } = this.params;

        let payload: { to: string; payload: Buffer };
        if (this.outputType === OutputType.Mint) {
            if (!isContractChain(toChain)) {
                throw new Error(
                    `Cannot mint to non-contract chain ${toChain.chain}.`,
                );
            }
            payload = await toChain.getOutputPayload(
                asset,
                this.outputType,
                toPayload,
            );
        } else {
            payload = await toChain.getOutputPayload(
                asset,
                this.outputType,
                toPayload,
            );
        }

        this.hash = toURLBase64(
            this.renVM.transactionHash({
                selector: this.selector,
                gHash: fromBase64(gHash),
                gPubKey: fromBase64(gPubKey),
                nHash: fromBase64(nHash),
                nonce: fromBase64(nonce),
                output: inputTransaction,
                amount: inputTransaction.amount,
                payload: payload.payload,
                pHash: fromBase64(pHash),
                to: payload.to,
            }),
        );

        if (!this.in) {
            this.in = new DefaultTxWaiter({
                chainTransaction: this.params.inputTransaction,
                chain: this.params.fromChain,
                target: await this.renVM.getConfirmationTarget(
                    this.params.fromChain.chain,
                ),
            });
        }

        return this;
    };

    /**
     * `queryTx` fetches the RenVM transaction details of the deposit.
     *
     * ```ts
     * await deposit.queryTx();
     * // > { to: "...", hash: "...", status: "done", in: {...}, out: {...} }
     */
    public queryTx = async (
        retries = 2,
    ): Promise<TxResponseWithStatus<CrossChainTxResponse>> => {
        if (
            this.queryTxResult &&
            this.queryTxResult.txStatus === TxStatus.TxStatusDone
        ) {
            return this.queryTxResult;
        }

        const response: TxResponseWithStatus<CrossChainTxResponse> =
            await this.renVM.queryTransaction(
                this.selector,
                fromBase64(this.hash),
                retries,
            );
        this.queryTxResult = response;

        // Update status.
        if (
            response.tx.out &&
            response.tx.out.revert &&
            response.tx.out.revert !== ""
        ) {
            this.status = TransactionStatus.Reverted;
            this.revertReason = response.tx.out.revert.toString();
        } else if (response.tx.out && response.tx.out.sig) {
            if (
                TransactionStatusIndex[this.status] <
                TransactionStatusIndex[TransactionStatus.Signed]
            ) {
                this.status = TransactionStatus.Signed;
                await this.onSignatureReady();
            }
        }

        return response;
    };

    /**
     * `refreshStatus` fetches the deposit's status on the mint-chain, RenVM
     * and lock-chain to calculate it's [[TransactionStatus]].
     *
     * ```ts
     * await deposit.refreshStatus();
     * // > "signed"
     * ```
     */
    public refreshStatus = async (
        initializing?: boolean,
    ): Promise<TransactionStatus> => {
        const getStatus = async (): Promise<TransactionStatus> => {
            let queryTxResult;

            // Fetch sighash.
            try {
                queryTxResult = await this.queryTx(1);
            } catch (_error) {
                // Ignore error.
                queryTxResult = null;
            }

            try {
                // Check if the transaction has been submitted to the mint-chain.
                const transaction = this.out && this.out.status;
                if (transaction !== undefined) {
                    return TransactionStatus.Submitted;
                }
            } catch (_error) {
                // Ignore error.
            }

            try {
                queryTxResult =
                    queryTxResult === undefined
                        ? await this.queryTx(1)
                        : queryTxResult;
                if (
                    queryTxResult &&
                    queryTxResult.txStatus === TxStatus.TxStatusDone
                ) {
                    // Check if transaction was reverted.
                    if (
                        queryTxResult.tx.out &&
                        queryTxResult.tx.out.revert &&
                        queryTxResult.tx.out.revert !== ""
                    ) {
                        this.status = TransactionStatus.Reverted;
                        this.revertReason =
                            queryTxResult.tx.out.revert.toString();
                    } else {
                        return TransactionStatus.Signed;
                    }
                }
            } catch (_error) {
                // Ignore error.
            }

            try {
                if (
                    isDefined(this.in.status.confirmations) &&
                    this.in.status.confirmations >= this.in.status.target
                ) {
                    return TransactionStatus.Confirmed;
                }
            } catch (_error) {
                // Ignore error.
            }

            return TransactionStatus.Detected;
        };
        if (initializing) {
            // TODO: Throw an error after a certain amount of retries, and
            // update status accordingly.
            while (true) {
                try {
                    this.status = await getStatus();
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                } catch (error: any) {
                    this._config.logger.error(error);
                    await sleep(this._config.networkDelay);
                }
            }
        } else {
            this.status = await getStatus();
        }
        return this.status;
    };

    // public in = {
    //     targetConfirmations: undefined as number | undefined,

    //     /**
    //      * `confirmations` returns the deposit's current and target number of
    //      * confirmations on the lock-chain.
    //      *
    //      * ```ts
    //      * await deposit
    //      *  .confirmations();
    //      * // > { current: 4, target: 6 }
    //      * ```
    //      */
    //     confirmations: async (): Promise<{
    //         current: number;
    //         target: number;
    //     }> => {
    //         const current = await this.params.fromChain.transactionConfidence(
    //             this.params.inputTransaction,
    //         );
    //         return {
    //             current: current.toNumber(),
    //             target: await this.in.confirmationTarget(),
    //         };
    //     },

    //     /**
    //      * `confirmed` will return once the deposit has reached the target number of
    //      * confirmations.
    //      *
    //      * It returns a PromiEvent which emits a `"confirmation"` event with the
    //      * current and target number of confirmations as the event parameters.
    //      *
    //      * The events emitted by the PromiEvent are:
    //      * 1. `"confirmation"` - called when a new confirmation is seen
    //      * 2. `"target"` - called immediately to make the target confirmations
    //      * available.
    //      *
    //      * ```ts
    //      * await deposit.from
    //      *  .confirmed()
    //      *  .on("target", (target) => console.log(`Waiting for ${target} confirmations`))
    //      *  .on("confirmation", (confs, target) => console.log(`${confs}/${target}`))
    //      * ```
    //      */
    //     confirmed: (): PromiEvent<
    //         GatewayTransaction<ToPayload>,
    //         { confirmation: [number, number]; target: [number] }
    //     > => {
    //         const promiEvent = newPromiEvent<
    //             GatewayTransaction<ToPayload>,
    //             { confirmation: [number, number]; target: [number] }
    //         >();

    //         (async () => {
    //             try {
    //                 promiEvent.emit(
    //                     "target",
    //                     await this.in.confirmationTarget(),
    //                 );
    //                 // eslint-disable-next-line @typescript-eslint/no-explicit-any
    //             } catch (error: any) {
    //                 this._config.logger.error(error);
    //             }

    //             // If the transaction has been confirmed according to RenVM, return.
    //             const transactionIsConfirmed = () =>
    //                 TransactionStatusIndex[this.status] >=
    //                     TransactionStatusIndex[TransactionStatus.Confirmed] ||
    //                 (this.queryTxResult &&
    //                     TxStatusIndex[this.queryTxResult.txStatus] >=
    //                         TxStatusIndex[TxStatus.TxStatusPending]);

    //             let iterationCount = 0;
    //             let currentConfidenceRatio = -1;
    //             // Continue while the transaction isn't confirmed and the promievent
    //             // isn't cancelled.
    //             while (true) {
    //                 if (promiEvent._isCancelled()) {
    //                     throw new Error(`PromiEvent cancelled.`);
    //                 }

    //                 // In the first loop, submit to RenVM immediately.
    //                 if (iterationCount % 5 === 1) {
    //                     try {
    //                         try {
    //                             if (!this._renTxSubmitted) {
    //                                 await this._submitMintTransaction(1);
    //                             }
    //                         } catch (error) {
    //                             this._config.logger.debug(error);
    //                         }
    //                         await this.queryTx();
    //                         if (transactionIsConfirmed()) {
    //                             break;
    //                         }
    //                         // eslint-disable-next-line @typescript-eslint/no-explicit-any
    //                     } catch (error: any) {
    //                         // Ignore error.
    //                         this._config.logger.debug(error);
    //                     }
    //                 }

    //                 try {
    //                     const confidence = await this.in.confirmations();
    //                     const confidenceRatio =
    //                         confidence.target === 0
    //                             ? 1
    //                             : confidence.current / confidence.target;
    //                     if (confidenceRatio > currentConfidenceRatio) {
    //                         currentConfidenceRatio = confidenceRatio;
    //                         promiEvent.emit(
    //                             "confirmation",
    //                             confidence.current,
    //                             confidence.target,
    //                         );
    //                     }
    //                     if (confidenceRatio >= 1) {
    //                         break;
    //                     }
    //                     this._config.logger.debug(
    //                         `deposit confidence: ${confidence.current} / ${confidence.target}`,
    //                     );
    //                     // eslint-disable-next-line @typescript-eslint/no-explicit-any
    //                 } catch (error: any) {
    //                     this._config.logger.error(
    //                         `Error fetching transaction confidence: ${extractError(
    //                             error,
    //                         )}`,
    //                     );
    //                 }

    //                 if (transactionIsConfirmed()) {
    //                     break;
    //                 }
    //                 await sleep(this._config.networkDelay);
    //                 iterationCount += 1;
    //             }

    //             // Update status.
    //             if (
    //                 TransactionStatusIndex[this.status] <
    //                 TransactionStatusIndex[TransactionStatus.Confirmed]
    //             ) {
    //                 this.status = TransactionStatus.Confirmed;
    //             }

    //             return this;
    //         })()
    //             .then(promiEvent.resolve)
    //             .catch(promiEvent.reject);

    //         return promiEvent;
    //     },
    // };

    private onSignatureReady = async () => {
        console.log("Called onSignatureReady!");
        if (
            !this.queryTxResult ||
            !this.queryTxResult.tx.out ||
            !this.queryTxResult.tx.out.sig
        ) {
            throw new Error(
                `Unable to submit to Ethereum without signature. Call 'signed' first.`,
            );
        }

        if (!this.outputType) {
            throw new Error(`Must call .initialize() first.`);
        }

        if (
            this.queryTxResult.tx.out &&
            this.queryTxResult.tx.out.txid &&
            this.queryTxResult.tx.out.txid.length > 0
        ) {
            // The transaction has already been submitted by RenVM.
            this.out = new DefaultTxWaiter({
                chainTransaction: {
                    txid: toURLBase64(this.queryTxResult.tx.out.txid),
                    txindex: this.queryTxResult.tx.out.txindex.toFixed(),
                },
                chain: this.params.fromChain,
                target: await this.renVM.getConfirmationTarget(
                    this.params.fromChain.chain,
                ),
            });
        } else if (isContractChain(this.params.toChain)) {
            const sigHash = this.queryTxResult.tx.out.sighash;
            const amount = this.queryTxResult.tx.out.amount;
            // const phash = this.queryTxResult.tx.in.phash;
            const signature = this.queryTxResult.tx.out.sig;
            const { r, s, v } = fixSignatureSimple(
                signature.slice(0, 32),
                signature.slice(32, 64),
                signature.slice(64, 65)[0],
            );

            // if (this.outputType === OutputType.Mint) {
            this.out = await this.params.toChain.submitOutput(
                this.outputType,
                this.params.asset,
                this.params.toPayload,
                {
                    amount,
                    nHash: fromBase64(this.params.nHash),
                    sHash: keccak256(Buffer.from(this.selector)),
                    pHash: fromBase64(this.params.pHash),
                    sigHash,
                    signature: {
                        r,
                        s,
                        v,
                    },
                },
                1,
            );
        } else {
            throw new Error(`Error setting 'out' transaction submitter.`);
        }

        //     if (!this.outTransaction) {
        //         throw new Error(
        //             `No transaction details returned from submission.`,
        //         );
        //     }
        //     // } else {
        //     //     this.outTransaction =
        //     //         await this.params.toChain.submitRelease(
        //     //             this.params.asset,
        //     //             this.params.toPayload,
        //     //             override || {},
        //     //             amount,
        //     //             phash,
        //     //             sigHash,
        //     //             {
        //     //                 r,
        //     //                 s,
        //     //                 v,
        //     //             },
        //     //             promiEvent,
        //     //         );
        //     // }
        // } else {

        // TODO: Add callback to TxSubmitted.

        //     this.outTransaction = {
        //         txindex: this.queryTxResult.tx.out.txindex.toFixed(),
        //         txid: this.queryTxResult.tx.out.txid.toString(),
        //     };
        // }

        // Update status.
        // this.status = TransactionStatus.Submitted;
    };

    /**
     * `signed` waits for RenVM's signature to be available.
     *
     * It returns a PromiEvent which emits a `"txHash"` event with the deposit's
     * RenVM txHash (aka Transaction ID).
     *
     * ```ts
     * await deposit
     *  .signed()
     *  .on("txHash", (txHash) => console.log(txHash))
     * ```
     *
     * The events emitted by the PromiEvent are:
     * 1. `txHash` - the RenVM transaction hash of the deposit.
     * 2. `status` - the RenVM status of the transaction, of type [[TxStatus]].
     *
     * @category Main
     */
    public signed = (): PromiEvent<
        GatewayTransaction<ToPayload>,
        { txHash: [string]; status: [TxStatus] }
    > => {
        const promiEvent = newPromiEvent<
            GatewayTransaction<ToPayload>,
            { txHash: [string]; status: [TxStatus] }
        >();

        console.log("!!");

        (async () => {
            let txHash = this.hash;

            // Check if the signature is already available.
            if (
                !this.queryTxResult ||
                !this.queryTxResult.tx.out ||
                // Not done and not reverted
                (this.queryTxResult.txStatus !== TxStatus.TxStatusDone &&
                    this.queryTxResult.txStatus !==
                        TxStatus.TxStatusReverted) ||
                // Output not populated
                Object.keys(this.queryTxResult.tx.out).length > 0
            ) {
                promiEvent.emit("txHash", txHash);
                this._config.logger.debug("RenVM txHash:", txHash);

                // Try to submit to RenVM. If that fails, see if they already
                // know about the transaction.
                try {
                    txHash = await this._submitMintTransaction(1);
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                } catch (error: any) {
                    this._config.logger.debug(error);

                    try {
                        // Check if the darknodes have already seen the transaction
                        const queryTxResponse = await this.queryTx(2);
                        if (queryTxResponse.txStatus === TxStatus.TxStatusNil) {
                            throw new Error(
                                `Transaction ${txHash} has not been submitted previously.`,
                            );
                        }
                        txHash = queryTxResponse.tx.hash;
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    } catch (errorInner: any) {
                        this._config.logger.debug(errorInner);

                        // Retry submitting to reduce chance of network issues
                        // causing problems.
                        txHash = await this._submitMintTransaction(5);
                    }
                }

                const response = await waitForTX(
                    this.renVM,
                    this.selector,
                    fromBase64(txHash),
                    (status) => {
                        promiEvent.emit("status", status);
                        this._config.logger.debug(
                            "transaction status:",
                            status,
                        );
                    },
                    () => promiEvent._isCancelled(),
                    this._config.networkDelay,
                    this._config.logger,
                );

                this.queryTxResult = response;
            }

            console.log("!");

            // Update status.
            if (
                this.queryTxResult.tx.out &&
                this.queryTxResult.tx.out.revert !== undefined &&
                this.queryTxResult.tx.out.revert !== ""
            ) {
                this.status = TransactionStatus.Reverted;
                this.revertReason = this.queryTxResult.tx.out.revert.toString();
                throw new Error(this.revertReason);
            } else if (
                this.queryTxResult.tx.out &&
                Object.keys(this.queryTxResult.tx.out).length > 0
            ) {
                if (
                    TransactionStatusIndex[this.status] <
                    TransactionStatusIndex[TransactionStatus.Signed]
                ) {
                    this.status = TransactionStatus.Signed;
                    await this.onSignatureReady();
                }
            }

            return this;
        })()
            .then(promiEvent.resolve)
            .catch(promiEvent.reject);

        return promiEvent;
    };

    // /**
    //  * `mint` submits the RenVM signature to the mint chain.
    //  *
    //  * It returns a PromiEvent and the events emitted depend on the mint chain.
    //  *
    //  * The PromiEvent's events are defined by the mint-chain implementation. For
    //  * Ethereum, it emits the same events as a Web3 PromiEvent.
    //  *
    //  * @category Main
    //  */
    // out = {
    //     /**
    //      * `find` checks if the deposit signature has already been
    //      * submitted to the mint chain.
    //      *
    //      * ```ts
    //      * await tx.to.find();
    //      * // > "0x1234" // (or undefined)
    //      * ```
    //      */
    //     find: async (): Promise<ChainTransaction | undefined> => {
    //         const promiEvent = newPromiEvent<
    //             // eslint-disable-next-line @typescript-eslint/no-explicit-any
    //             ChainTransaction | undefined,
    //             // eslint-disable-next-line @typescript-eslint/no-explicit-any
    //             {
    //                 transaction: [ChainTransaction];
    //                 confirmation: [number, { status: number }];
    //             }
    //         >();

    //         (async () => {
    //             if (isContractChain(this.params.toChain)) {
    //                 const sigHash =
    //                     this.queryTxResult &&
    //                     this.queryTxResult.tx.out &&
    //                     this.queryTxResult.tx.out.revert === undefined
    //                         ? this.queryTxResult.tx.out.sighash
    //                         : undefined;

    //                 const sig =
    //                     this.queryTxResult &&
    //                     this.queryTxResult.tx.out &&
    //                     this.queryTxResult.tx.out.revert === undefined
    //                         ? this.queryTxResult.tx.out.sig
    //                         : undefined;

    //                 const signature = sig
    //                     ? fixSignatureSimple(
    //                           sig.slice(0, 32),
    //                           sig.slice(32, 64),
    //                           sig.slice(64, 65)[0],
    //                       )
    //                     : undefined;

    //                 // Check if the signature has already been submitted
    //                 this.outTransaction =
    //                     await this.params.toChain.submitOutput(
    //                         true,
    //                         this.outputType!,
    //                         this.params.asset,
    //                         this.params.toPayload,
    //                         {},
    //                         {
    //                             nHash: fromBase64(this.params.nHash),
    //                             sHash: keccak256(Buffer.from(this.selector)),
    //                             pHash: fromBase64(this.params.pHash),
    //                             amount: new BigNumber(
    //                                 this.params.inputTransaction.amount,
    //                             ),
    //                             sigHash: sigHash
    //                                 ? fromBase64(sigHash)
    //                                 : undefined,
    //                             signature,
    //                         },
    //                         promiEvent,
    //                     );
    //                 return this.outTransaction;
    //             }
    //             return undefined;
    //         })()
    //             .then(promiEvent.resolve)
    //             .catch(promiEvent.reject);

    //         return promiEvent;
    //     },

    //     submit: (
    //         override?: { [name: string]: unknown },
    //         // eslint-disable-next-line @typescript-eslint/no-explicit-any
    //     ): PromiEvent<
    //         ChainTransaction,
    //         {
    //             transaction: [ChainTransaction];
    //             confirmation: [number, { status: number }];
    //         }
    //     > => {
    //         const promiEvent = newPromiEvent<
    //             // eslint-disable-next-line @typescript-eslint/no-explicit-any
    //             ChainTransaction,
    //             // eslint-disable-next-line @typescript-eslint/no-explicit-any
    //             {
    //                 transaction: [ChainTransaction];
    //                 confirmation: [number, { status: number }];
    //             }
    //         >();

    //         (async () => {

    //         return promiEvent;
    //     },
    // };

    // Private methods /////////////////////////////////////////////////////////

    /**
     * `_submitMintTransaction` will create the RebVN mint transaction and return
     * its txHash. If `config.submit` is true, it will also submit it to RenVM.
     *
     * Note that `_submitMintTransaction`'s return type changes from `string` to
     * `Promise<string>` if `config.submit` is true. This may be split up into
     * two methods in the future to avoid this weirdness - likely once the `v1`
     * RPC format is phased out.
     *
     * @param config Set `config.submit` to `true` to submit the transaction.
     */
    private _submitMintTransaction = async (
        retries: number,
    ): Promise<string> => {
        const expectedTxHash = this.hash;

        // Return if the transaction has already been successfully submitted.
        if (this._renTxSubmitted) {
            return expectedTxHash;
        }

        // The transaction has already been submitted and accepted.
        if (this._renTxSubmitted) {
            return expectedTxHash;
        }

        const {
            asset,
            toChain: to,
            toPayload,
            gPubKey,
            nonce,
            nHash,
            pHash,
            gHash,
            inputTransaction,
        } = this.params;

        if (!isContractChain(to)) {
            throw new Error(`Cannot mint to non-contract chain ${to.chain}.`);
        }

        const payload = await to.getOutputPayload(
            asset,
            this.outputType!,
            toPayload,
        );

        const encodedHash = await this.renVM.submitTransaction(
            {
                selector: this.selector,
                gHash: fromBase64(gHash),
                gPubKey: fromBase64(gPubKey),
                nHash: fromBase64(nHash),
                nonce: fromBase64(nonce),
                output: {
                    txindex: inputTransaction.txindex,
                    txid: inputTransaction.txid,
                },
                amount: inputTransaction.amount,
                payload: fromBase64(payload.payload),
                pHash: fromBase64(pHash),
                to: payload.to,
            },
            retries,
        );

        const returnedTxHash = toURLBase64(encodedHash);

        // Indicate that the tx has been submitted successfully.
        this._renTxSubmitted = true;

        if (returnedTxHash !== expectedTxHash) {
            this._config.logger.warn(
                `Unexpected txHash returned from RenVM. Received: ${returnedTxHash}, expected: ${expectedTxHash}`,
            );
        }

        this._renTxSubmitted = true;

        return returnedTxHash;
    };

    /* ====================================================================== */

    public static New = async <
        ToPayload_ extends { chain: string; chainClass?: Chain } = {
            chain: string;
            chainClass?: Chain;
        },
    >(
        renVM: RenVMProvider,
        params: TransactionParams<ToPayload_>,
        config?: RenJSConfig,
    ): Promise<GatewayTransaction<ToPayload_>> => {
        const gatewayTransaction = new GatewayTransaction<ToPayload_>(
            renVM,
            params,
            config,
        );
        await gatewayTransaction._initialize();
        return gatewayTransaction;
    };
}
