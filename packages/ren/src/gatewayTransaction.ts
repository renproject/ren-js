import BigNumber from "bignumber.js";

import { RenVMProvider, RenVMShard } from "@renproject/provider";
import {
    CrossChainTxInput,
    CrossChainTxOutput,
    CrossChainTxWithStatus,
    UnmarshalledTxOutput,
} from "@renproject/provider/build/main/unmarshal";
import {
    Chain,
    ChainTransaction,
    DefaultTxWaiter,
    fixSignature,
    fromBase64,
    generateGHash,
    generateNHash,
    generatePHash,
    generateSHash,
    InputChainTransaction,
    InputType,
    isContractChain,
    isDefined,
    keccak256,
    OutputType,
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
    ToPayload extends { chain: string } = {
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
    public out: TxSubmitter | TxWaiter;
    public renVM: RenVMCrossChainTxSubmitter;

    // Private
    private queryTxResult: CrossChainTxWithStatus | undefined;
    private _renTxSubmitted: boolean = false;

    private inputType: InputType | undefined;
    private outputType: OutputType | undefined;

    /** @hidden */
    constructor(
        renVM: RenVMProvider,
        fromChain: Chain,
        toChain: Chain,
        params: TransactionParams<ToPayload>,
        fromTxWaiter?: TxSubmitter | TxWaiter,
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

        // `processDeposit` will call `refreshStatus` which will set the proper
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
    public readonly _initialize = async (): Promise<this> => {
        const { inputType, outputType, selector } =
            await getInputAndOutputTypes({
                asset: this.params.asset,
                fromChain: this.fromChain,
                toChain: this.toChain,
            });
        this.inputType = inputType;
        this.outputType = outputType;
        this.selector = selector;

        const { asset, nonce, fromTx, to } = this.params;

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

        const txParams = {
            selector: this.selector,
            gHash: this.gHash,
            gPubKey: gPubKey,
            nHash: this.nHash,
            nonce: nonceBuffer,
            output: fromTx,
            amount: fromTx.amount,
            payload: payload.payload,
            pHash: this.pHash,
            to: payload.to,
        };

        this.hash = toURLBase64(this.provider.transactionHash(txParams));

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

        this.renVM.eventEmitter.on("status", (status) => {
            this.queryTxResult = status.response;
        });

        return this;
    };

    /**
     * `queryTx` fetches the RenVM transaction details of the deposit.
     *
     * ```ts
     * await deposit.queryTx();
     * // > { to: "...", hash: "...", status: "done", in: {...}, out: {...} }
     */
    public queryTx = async (retries = 2): Promise<CrossChainTxWithStatus> => {
        if (
            this.queryTxResult &&
            this.queryTxResult.txStatus === TxStatus.TxStatusDone
        ) {
            return this.queryTxResult;
        }

        const response: CrossChainTxWithStatus =
            await this.provider.queryTransaction(
                fromBase64(this.hash),
                retries,
            );
        this.queryTxResult = response;

        // Update status.
        if (
            response.tx.out &&
            response.tx.out.revert &&
            response.tx.out.revert.length > 0 &&
            response.tx.out.sig &&
            response.tx.out.sig.length > 0
        ) {
            await this.onSignatureReady(response.tx);
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

    private onSignatureReady = async (
        tx: UnmarshalledTxOutput<CrossChainTxInput, CrossChainTxOutput>,
    ) => {
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
            this.out = new DefaultTxWaiter({
                chainTransaction: {
                    chain: this.toChain.chain,
                    txid,
                    txindex,
                    txidFormatted: this.toChain.transactionHash({
                        txid,
                        txindex,
                    }),
                },
                chain: this.toChain,
                target: 0,
            });
        } else if (isContractChain(this.toChain)) {
            if (!this.outputType) {
                throw new Error(`Must call .initialize() first.`);
            }

            if (!tx.out.sig) {
                throw new Error(
                    `Unable to submit without signature. Call 'signed' first.`,
                );
            }

            const sigHash = tx.out.sighash;
            const amount = tx.out.amount;
            // const phash = tx.in.phash;
            const signature = tx.out.sig;
            const { r, s, v } = fixSignature(
                signature.slice(0, 32),
                signature.slice(32, 64),
                signature.slice(64, 65)[0],
            );

            // if (this.outputType === OutputType.Mint) {
            this.out = await this.toChain.getOutputTx(
                this.outputType,
                this.params.asset,
                this.params.to,
                () => ({
                    amount,
                    nHash: this.nHash,
                    sHash: keccak256(Buffer.from(this.selector)),
                    pHash: this.pHash,
                    sigHash,
                    signature: {
                        r,
                        s,
                        v,
                    },
                }),
                1,
            );
        } else {
            throw new Error(`Error setting 'out' transaction submitter.`);
        }
    };

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

        const { asset, to, nonce, fromTx } = this.params;

        if (!isContractChain(this.toChain)) {
            throw new Error(
                `Cannot mint ${asset} to non-contract chain ${to.chain}.`,
            );
        }

        const payload = await this.toChain.getOutputPayload(
            asset,
            this.outputType!,
            to,
        );

        const nonceBuffer = nonce
            ? Buffer.isBuffer(nonce)
                ? nonce
                : fromBase64(nonce)
            : toNBytes(0, 32);

        const encodedHash = await this.provider.submitTransaction(
            {
                selector: this.selector,
                gHash: this.gHash,
                gPubKey: this.params.shard
                    ? fromBase64(this.params.shard.gPubKey)
                    : Buffer.from([]),
                nHash: this.nHash,
                nonce: nonceBuffer,
                output: {
                    txindex: fromTx.txindex,
                    txid: fromTx.txid,
                },
                amount: fromTx.amount,
                payload: payload.payload,
                pHash: this.pHash,
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
}
