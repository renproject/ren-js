import BigNumber from "bignumber.js";

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
    InputChainTransaction,
    InputType,
    isContractChain,
    isDepositChain,
    OutputType,
    RenJSError,
    RenVMShard,
    TxSubmitter,
    TxWaiter,
    utils,
} from "@renproject/utils";

import { defaultRenJSConfig, RenJSConfig } from "./config";
import { RenVMCrossChainTxSubmitter } from "./renVMTxSubmitter";
import { getInputAndOutputTypes } from "./utils/inputAndOutputTypes";

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

    /** See [[RenJS.renVM]]. */
    public provider: RenVMProvider;
    public fromChain: Chain;
    public toChain: Chain;

    public nHash: Buffer;
    public pHash: Buffer;
    public gHash: Buffer;

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

        // Set hash to "" rather than undefined so that it's type is always
        // `string`. The hash will be set in `_initialize` which should be
        // called immediately after the constructor.
        this.hash = "";

        const nonce = utils.isDefined(params.nonce)
            ? utils.fromBase64(params.nonce)
            : utils.toNBytes(0, 32);
        this.nHash = generateNHash(
            nonce,
            utils.fromBase64(params.fromTx.txid),
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
                : utils.fromBase64(nonce)
            : utils.toNBytes(0, 32);

        this.gHash = generateGHash(
            this.pHash,
            sHash,
            payload.toBytes,
            nonceBuffer,
        );

        const gPubKey = this.params.shard
            ? utils.fromBase64(this.params.shard.gPubKey)
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
                isDepositChain(this.toChain) &&
                (await this.toChain.isDepositAsset(this.params.asset))
            ) {
                if (!tx.out || !tx.out.txid || !tx.out.txid.length) {
                    throw new ErrorWithCode(
                        `Expected release transaction details in RenVM response.`,
                        RenJSError.INTERNAL_ERROR,
                    );
                }

                // The transaction has already been submitted by RenVM.
                const txid = utils.toURLBase64(tx.out.txid);
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
                nonce: nonceBuffer,
                nhash: this.nHash,
                gpubkey: gPubKey,
                ghash: this.gHash,
            },
            onSignatureReady,
        );
        this.hash = this.renVM._hash;

        this.renVM.eventEmitter.on("progress", (status) => {
            this.queryTxResult = status.response;
        });

        const getOutputParams = () => ({
            amount:
                this.queryTxResult && this.queryTxResult.tx.out
                    ? this.queryTxResult.tx.out.amount
                    : undefined,
            nHash: this.nHash,
            sHash: utils.keccak256(Buffer.from(this.selector)),
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
    }
}
