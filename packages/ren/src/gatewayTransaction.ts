import BigNumber from "bignumber.js";

import { RenVMProvider } from "@renproject/provider";
import {
    RenVMCrossChainTransaction,
    RenVMTransactionWithStatus,
} from "@renproject/provider/build/main/unmarshal";
import {
    Chain,
    ChainTransaction,
    ChainTransactionProgress,
    DefaultTxWaiter,
    fromBase64,
    generateGHash,
    generateNHash,
    generatePHash,
    generateSHash,
    InputChainTransaction,
    InputType,
    isContractChain,
    isDefined,
    isDepositChain,
    keccak256,
    OutputType,
    RenVMShard,
    sleep,
    toNBytes,
    toURLBase64,
    TxStatus,
    TxSubmitter,
    TxWaiter,
} from "@renproject/utils";

import { defaultRenJSConfig, RenJSConfig } from "./config";
import { RenVMCrossChainTxSubmitter } from "./renVMTxSubmitter";
import { getInputAndOutputTypes } from "./utils/inputAndOutputTypes";

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
    ToPayload extends { chain: string; txConfig?: any } = {
        chain: string;
    },
> {
    asset: string;
    to: ToPayload;
    /**
     * The public key of the RenVM shard selected when `fromTx` was submitted.
     * If the input is contract/event-based then it should be left empty.
     *
     * @default Buffer.from([])
     */
    shard?: RenVMShard;
    /**
     * @default toBytes(0,32)
     */
    nonce?: string;

    /**
     * A gateway transaction always has a input transaction on the origin-chain.
     */
    fromTx: InputChainTransaction;
}

export class GatewayTransaction<
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
    public hash: string;
    public selector: string;

    /**
     * The status of the deposit, updated automatically. You can also call
     * `fetchStatus` to re-fetch this.
     *
     * ```ts
     * deposit.status;
     * // > "signed"
     * ```
     */
    public status: TransactionStatus;

    /** See [[RenJS.renVM]]. */
    public provider: RenVMProvider;
    public fromChain: Chain;
    public toChain: Chain;

    public nHash: Buffer;
    public pHash: Buffer;
    public gHash: Buffer;

    public outTransaction?: ChainTransaction;
    public revertReason?: string;

    public _config: typeof defaultRenJSConfig & RenJSConfig;

    public in: TxSubmitter | TxWaiter;
    public out:
        | TxSubmitter<ChainTransactionProgress, ToPayload["txConfig"]>
        | TxWaiter;
    public renVM: RenVMCrossChainTxSubmitter;

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
        fromTxWaiter?: TxSubmitter<ChainTransactionProgress, any> | TxWaiter,
        config?: RenJSConfig,
    ) {
        this.provider = renVM;
        this.params = params;
        this._config = {
            ...defaultRenJSConfig,
            ...config,
        };
        this.fromChain = fromChain;
        this.toChain = toChain;

        // `processDeposit` will call `fetchStatus` which will set the proper
        // status.
        this.status = TransactionStatus.FetchingStatus;

        // Set hash to "" rather than undefined so that it's type is always
        // `string`. The hash will be set in `_initialize` which should be
        // called immediately after the constructor.
        this.hash = "";

        const nonce = isDefined(params.nonce)
            ? fromBase64(params.nonce)
            : toNBytes(0, 32);
        this.nHash = generateNHash(
            nonce,
            fromBase64(params.fromTx.txid),
            params.fromTx.txindex,
        );

        if (fromTxWaiter) {
            this.in = fromTxWaiter;
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
    public async initialize(): Promise<this> {
        const { inputType, outputType, selector } =
            await getInputAndOutputTypes({
                asset: this.params.asset,
                fromChain: this.fromChain,
                toChain: this.toChain,
            });
        this.inputType = inputType;
        this.outputType = outputType;
        this.selector = selector;

        const { asset, nonce, to } = this.params;

        const payload = await this.toChain.getOutputPayload(
            asset,
            this.outputType as any,
            to,
        );

        const sHash = generateSHash(
            `${this.params.asset}/to${this.params.to.chain}`,
        );

        this.pHash = generatePHash(payload.payload);

        const nonceBuffer = nonce
            ? Buffer.isBuffer(nonce)
                ? nonce
                : fromBase64(nonce)
            : toNBytes(0, 32);

        this.gHash = generateGHash(
            this.pHash,
            sHash,
            payload.toBytes,
            nonceBuffer,
        );

        const gPubKey = this.params.shard
            ? fromBase64(this.params.shard.gPubKey)
            : Buffer.from([]);

        if (!this.in) {
            this.in = new DefaultTxWaiter({
                chainTransaction: this.params.fromTx,
                chain: this.fromChain,
                target: await this.provider.getConfirmationTarget(
                    this.fromChain.chain,
                ),
            });
        }

        this.renVM = new RenVMCrossChainTxSubmitter(
            this.provider,
            this.selector,
            {
                txid: fromBase64(this.params.fromTx.txid), // Buffer;
                txindex: new BigNumber(this.params.fromTx.txindex), // BigNumber;
                amount: new BigNumber(this.params.fromTx.amount), // BigNumber;
                payload: payload.payload, // Buffer;
                phash: this.pHash, // Buffer;
                to: payload.to, // string;
                nonce: nonceBuffer, // Buffer;
                nhash: this.nHash, // Buffer;
                gpubkey: gPubKey, // Buffer;
                ghash: this.gHash, // Buffer;
            },
            this.onSignatureReady,
        );
        this.hash = this.renVM._hash;

        this.renVM.eventEmitter.on("status", (status) => {
            this.queryTxResult = status.response;
        });

        // if (this.outputType === OutputType.Mint) {
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
                this.outputType,
                this.params.asset,
                this.params.to,
                () => ({
                    amount:
                        this.queryTxResult && this.queryTxResult.tx.out
                            ? this.queryTxResult.tx.out.amount
                            : undefined,
                    nHash: this.nHash,
                    sHash: keccak256(Buffer.from(this.selector)),
                    pHash: this.pHash,
                    sigHash:
                        this.queryTxResult && this.queryTxResult.tx.out
                            ? this.queryTxResult.tx.out.sighash
                            : undefined,
                    signature:
                        this.queryTxResult && this.queryTxResult.tx.out
                            ? this.queryTxResult.tx.out.sig
                            : undefined,
                }),
                1,
            );
        } else {
            throw new Error(`Error setting 'out' transaction submitter.`);
        }

        return this;
    }

    /**
     * `queryTx` fetches the RenVM transaction details of the deposit.
     *
     * ```ts
     * await deposit.queryTx();
     * // > { to: "...", hash: "...", status: "done", in: {...}, out: {...} }
     */
    public queryTx = async (
        retries = 2,
    ): Promise<RenVMTransactionWithStatus<RenVMCrossChainTransaction>> => {
        if (
            this.queryTxResult &&
            this.queryTxResult.txStatus === TxStatus.TxStatusDone
        ) {
            return this.queryTxResult;
        }

        const response = await this.provider.queryTx(this.hash, retries);
        this.queryTxResult = response;

        // Update status.
        if (
            response.tx.out &&
            response.tx.out.revert &&
            response.tx.out.revert.length > 0 &&
            response.tx.out.sig &&
            response.tx.out.sig.length > 0
        ) {
            this.onSignatureReady(response);
        }

        return response;
    };

    /**
     * `fetchStatus` fetches the deposit's status on the mint-chain, RenVM
     * and lock-chain to calculate it's [[TransactionStatus]].
     *
     * ```ts
     * await deposit.fetchStatus();
     * // > "signed"
     * ```
     */
    public fetchStatus = async (
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

    private onSignatureReady = (
        txWithStatus: RenVMTransactionWithStatus<RenVMCrossChainTransaction>,
    ) => {
        this.queryTxResult = txWithStatus;
        const { tx } = txWithStatus;
        if (tx.out && tx.out.revert && tx.out.revert !== "") {
            this.status = TransactionStatus.Reverted;
            this.revertReason = tx.out.revert;
            return;
        }

        this.status = TransactionStatus.Signed;

        if (tx.out && tx.out.txid && tx.out.txid.length > 0) {
            // The transaction has already been submitted by RenVM.
            const txid = toURLBase64(tx.out.txid);
            const txindex = tx.out.txindex.toFixed();
            (this.out as DefaultTxWaiter).setTransaction({
                chain: this.toChain.chain,
                txid,
                txindex,
                txidFormatted: this.toChain.formattedTransactionHash({
                    txid,
                    txindex,
                }),
            });
        }
    };
}
