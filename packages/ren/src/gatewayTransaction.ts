import {
    RenVMCrossChainTransaction,
    RenVMProvider,
    RenVMTransactionWithStatus,
} from "@renproject/provider";
import {
    Chain,
    ChainTransactionProgress,
    DefaultTxWaiter,
    ErrorWithCode,
    generateGHash,
    generateNHash,
    generatePHash,
    generateSHash,
    InputType,
    isContractChain,
    isDepositChain,
    isEmptySignature,
    OutputType,
    RenJSError,
    TxStatus,
    TxSubmitter,
    TxWaiter,
    TxWaiterProxy,
    utils,
} from "@renproject/utils";
import BigNumber from "bignumber.js";

import { TransactionParams } from "./params";
import { RenVMCrossChainTxSubmitter } from "./renVMTxSubmitter";
import { defaultRenJSConfig, RenJSConfig } from "./utils/config";
import { getInputAndOutputTypes } from "./utils/inputAndOutputTypes";

/**
 * A GatewayTransaction handles a specific bridging transaction through RenVM.
 * It includes an input chain transaction that should have already been
 * submitted, a RenVM transaction, and an output chain transaction.
 * Additionally, there may be some setup transactions required to be submitted
 * before the output transaction.
 */
export class GatewayTransaction<
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ToPayload extends { chain: string; txConfig?: any } = {
        chain: string;
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
    private _hash: string | undefined;
    public get hash(): string {
        return this._defaultGetter("_hash") || this._hash;
    }
    public selector: string;

    public provider: RenVMProvider;
    public fromChain: Chain;
    public toChain: Chain;

    public nHash: Uint8Array;
    public pHash: Uint8Array;
    public gHash: Uint8Array;

    public _config: typeof defaultRenJSConfig & RenJSConfig;

    public in: TxSubmitter | TxWaiter;
    public renVM: RenVMCrossChainTxSubmitter;
    public outSetup: { [key: string]: TxSubmitter | TxWaiter } = {};
    public out:
        | TxSubmitter<ChainTransactionProgress, ToPayload["txConfig"]>
        | TxWaiter;

    // Private
    private queryTxResult:
        | RenVMTransactionWithStatus<RenVMCrossChainTransaction>
        | undefined;

    public inputType: InputType | undefined;
    public outputType: OutputType | undefined;

    /** @hidden */
    public constructor(
        renVM: RenVMProvider,
        fromChain: Chain,
        toChain: Chain,
        params: TransactionParams<ToPayload>,
        fromTxWaiter?: TxSubmitter<ChainTransactionProgress> | TxWaiter,
        config?: RenJSConfig,
    ) {
        this.provider = renVM;
        this.params = { ...params };
        this._config = {
            ...defaultRenJSConfig,
            ...config,
        };
        this.fromChain = fromChain;
        this.toChain = toChain;

        const nonce =
            typeof params.nonce === "string"
                ? utils.fromBase64(params.nonce)
                : utils.toNBytes(params.nonce || 0, 32);

        this.nHash = generateNHash(
            nonce,
            utils.fromBase64(params.fromTx.txid),
            params.fromTx.txindex,
        );

        if (fromTxWaiter) {
            this.in = new TxWaiterProxy(
                fromTxWaiter,
                params.fromTx,
            ) as unknown as TxWaiter;
        } else {
            this.in = undefined as never;
        }

        // TODO: Throw error if this.out is accessed before this.signed().
        this.selector = undefined as never;
        this.out = undefined as never;
        this.pHash = undefined as never;
        this.gHash = undefined as never;
        this.renVM = undefined as never;
    }

    /** @hidden */
    public initialize: () => Promise<this> = async () => {
        const { inputType, outputType, selector } =
            await getInputAndOutputTypes({
                asset: this.params.asset,
                fromChain: this.fromChain,
                toChain: this.toChain,
            });
        this.inputType = inputType;
        this.outputType = outputType;
        this.selector = selector;

        const { asset, nonce, to, fromTx } = this.params;

        let payload = await this.toChain.getOutputPayload(
            asset,
            this.inputType,
            this.outputType,
            to,
        );

        if (fromTx.toRecipient) {
            try {
                const fromTxPayload = {
                    to: fromTx.toRecipient,
                    toBytes: this.toChain.addressToBytes(fromTx.toRecipient),
                    payload: fromTx.toPayload
                        ? utils.fromBase64(fromTx.toPayload)
                        : new Uint8Array([]),
                };
                if (payload) {
                    if (payload.to !== fromTxPayload.to) {
                        this._config.logger.warn(
                            `Expected recipient to be ${fromTxPayload.to}, instead got ${payload.to}.`,
                        );
                    }
                    if (
                        utils.toBase64(payload.payload) !==
                        utils.toBase64(fromTxPayload.payload)
                    ) {
                        this._config.logger.warn(
                            `Expected payload to be ${utils.toBase64(
                                fromTxPayload.payload,
                            )}, instead got ${utils.toBase64(
                                payload.payload,
                            )}.`,
                        );
                    }
                    if (
                        utils.toBase64(payload.toBytes) !==
                        utils.toBase64(fromTxPayload.toBytes)
                    ) {
                        this._config.logger.warn(
                            `Expected decoded recipient to be ${utils.toBase64(
                                fromTxPayload.toBytes,
                            )}, instead got ${utils.toBase64(
                                payload.toBytes,
                            )}.`,
                        );
                    }
                } else {
                    payload = fromTxPayload;
                }
            } catch (error) {
                if (!payload) {
                    throw ErrorWithCode.updateError(
                        error,
                        RenJSError.PARAMETER_ERROR,
                        `No target payload provided.`,
                    );
                }
            }
        }

        if (!payload) {
            throw new ErrorWithCode(
                `No target payload provided.`,
                RenJSError.PARAMETER_ERROR,
            );
        }

        const sHash = generateSHash(
            `${this.params.asset}/to${this.params.to.chain}`,
        );

        this.pHash = generatePHash(payload.payload);

        const nonceBytes: Uint8Array =
            typeof nonce === "string"
                ? utils.fromBase64(nonce)
                : utils.toNBytes(nonce || 0, 32);

        this.gHash = generateGHash(
            this.pHash,
            sHash,
            payload.toBytes,
            nonceBytes,
        );

        const gPubKey = this.params.shard
            ? utils.fromBase64(this.params.shard.gPubKey)
            : new Uint8Array();

        if (!this.in) {
            this.in = new DefaultTxWaiter({
                chainTransaction: this.params.fromTx,
                chain: this.fromChain,
                target: await this.provider.getConfirmationTarget(
                    this.fromChain.chain,
                ),
            });
        }

        const onSignatureReady = async (
            txWithStatus: RenVMTransactionWithStatus<RenVMCrossChainTransaction>,
        ): Promise<void> => {
            this.queryTxResult = txWithStatus;
            const { tx } = txWithStatus;
            if (tx.out && tx.out.revert && tx.out.revert !== "") {
                throw new ErrorWithCode(
                    `RenVM transaction reverted: ${tx.out.revert}`,
                    RenJSError.RENVM_TRANSACTION_REVERTED,
                );
            }

            if (
                tx.out &&
                tx.out.txid &&
                tx.out.txid.length > 0 &&
                isEmptySignature(tx.out.sig)
            ) {
                // The transaction has already been submitted.
                const txid = utils.toURLBase64(tx.out.txid);
                const txindex = tx.out.txindex.toFixed();

                const txHash = this.toChain.txHashFromBytes(
                    utils.fromBase64(txid),
                );

                await this.out.setTransaction({
                    chain: this.toChain.chain,
                    txid,
                    txindex,
                    txHash,
                    explorerLink:
                        this.toChain.transactionExplorerLink({
                            txHash,
                            txindex,
                            txid,
                        }) || "",
                });
            } else if (
                isDepositChain(this.toChain) &&
                (await this.toChain.isDepositAsset(this.params.asset))
            ) {
                throw new ErrorWithCode(
                    `Expected release transaction details in RenVM response.`,
                    RenJSError.INTERNAL_ERROR,
                );
            }
        };

        const network = await this.provider.getNetwork();

        this.renVM = new RenVMCrossChainTxSubmitter(
            this.provider,
            this.selector,
            {
                txid: utils.fromBase64(this.params.fromTx.txid),
                txindex: new BigNumber(this.params.fromTx.txindex),
                amount: new BigNumber(this.params.fromTx.amount),
                payload: payload.payload,
                phash: this.pHash,
                to: payload.to,
                nonce: nonceBytes,
                nhash: this.nHash,
                gpubkey: gPubKey,
                ghash: this.gHash,
            },
            onSignatureReady,
            this._config,
            network,
        );
        this._hash = this.renVM.tx.hash;

        this.renVM.eventEmitter.on("progress", (status) => {
            // Check if status.response's txStatus is outdated.
            if (
                this.queryTxResult &&
                this.queryTxResult.txStatus === TxStatus.TxStatusDone &&
                status.response &&
                status.response.txStatus !== TxStatus.TxStatusDone
            ) {
                console.warn(
                    "RenVM transaction emitted outdated progress event.",
                    this.queryTxResult,
                    status.response,
                );
                return;
            }
            this.queryTxResult = status.response;
        });

        try {
            await this.renVM.query();
        } catch (error: unknown) {
            // Ignore error, possible submitted too soon before RenVM's nodes
            // have seen the transaction.
        }

        const getOutputParams = () => ({
            amount:
                this.queryTxResult && this.queryTxResult.tx.out
                    ? this.queryTxResult.tx.out.amount
                    : undefined,
            nHash: this.nHash,
            sHash: utils.keccak256(utils.fromUTF8String(this.selector)),
            pHash: this.pHash,
            sigHash:
                this.queryTxResult && this.queryTxResult.tx.out
                    ? this.queryTxResult.tx.out.sighash
                    : undefined,
            signature:
                this.queryTxResult && this.queryTxResult.tx.out
                    ? this.queryTxResult.tx.out.sig
                    : undefined,
        });

        if (isContractChain(this.toChain) && this.toChain.getOutSetup) {
            this.outSetup = {
                ...this.outSetup,
                ...(await this.toChain.getOutSetup(
                    asset,
                    this.inputType,
                    this.outputType,
                    to,
                    getOutputParams,
                )),
            };
        }

        if (
            isDepositChain(this.toChain) &&
            (await this.toChain.isDepositAsset(this.params.asset))
        ) {
            this.out = new DefaultTxWaiter({
                chain: this.toChain,
                target: 0,
            });
        } else if (isContractChain(this.toChain)) {
            this.out = await this.toChain.getOutputTx(
                this.inputType,
                this.outputType,
                this.params.asset,
                this.params.to,
                getOutputParams,
                1,
            );
        } else {
            throw new Error(`Error setting 'out' transaction submitter.`);
        }

        return this;
    };

    /** PRIVATE METHODS */

    private _defaultGetter = (name: string) => {
        if (this[name] === undefined) {
            throw new Error(
                `Must call 'initialize' before accessing '${name}'.`,
            );
        }
        return this[name];
    };
}
