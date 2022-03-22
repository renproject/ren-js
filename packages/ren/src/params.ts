import {
    InputChainTransaction,
    RenVMShard,
    UrlBase64String,
} from "@renproject/utils";

/**
 * The parameters for a cross-chain transfer onto Ethereum.
 */
export interface GatewayParams<
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    FromPayload extends { chain: string; txConfig?: any } = any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ToPayload extends { chain: string; txConfig?: any } = any,
> {
    /**
     * The asset being minted or burned - e.g. `"BTC"`.
     */
    asset: string;

    /**
     * A payload for the chain being bridged from.
     *
     * @example
     * ethereum.Account({ amount: 1 })
     */
    from: FromPayload;

    /**
     * A payload for the chain being bridged to.
     *
     * @example
     * bitcoin.Address("miMi...")
     */
    to: ToPayload;

    /**
     * A Gateway's gateway address can be forced to be unique by providing a
     * 32-byte nonce.
     *
     * The nonce should be passed is as a 32-byte Uint8Array or a 32-byte hex
     * string, with or without a "0x" prefix.
     *
     * It defaults to 0 (32 empty bytes).
     *
     * WARNING: If the nonce is lost between detecting a deposit and
     * submitting it to RenVM, the deposit's funds can't be recovered.
     * A nonce should only be provided if it's guaranteed to be stored in
     * persistent storage before a gateway address is shown to the user.
     *
     * @example
     * ```
     * // Number
     * nonce: 100,
     *
     * // String
     * nonce: "ZA", // In URL-base64 or standard base64 format.
     *
     * // String
     * nonce: toURLBase64(new Uint8Array([100])) // from @renproject/utils
     * ```
     *
     *
     * @example
     * ```
     * // Use a nonce based on the number of days since epoch, in order to
     * // generate a new gateway address each day.
     * nonce: utils.toNBytes(new BigNumber(Math.floor(Date.now() / 8.64e7)), 32)
     * ```
     */
    nonce?: UrlBase64String | number;

    /**
     * The public key of the RenVM shard selected when `fromTx` was submitted.
     * If the input is contract/event-based then it should be left empty.
     */
    shard?: RenVMShard;

    /**
     * Provide an optional tag which can be used to look up transfers in the
     * lightnode.
     */
    tag?: string;
}

export interface TransactionParams<
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ToPayload extends { chain: string; txConfig?: any } = {
        chain: string;
    },
> {
    /**
     * The asset being minted or burned - e.g. `"BTC"`.
     */
    asset: string;

    /**
     * A payload for the chain being bridged to.
     *
     * @example
     * bitcoin.Address("miMi...")
     */
    to: ToPayload;

    /**
     * A gateway transaction always has a input transaction on the origin-chain.
     */
    fromTx: InputChainTransaction;

    /**
     * See [[GatewayParams["shard"]]].
     */
    shard?: GatewayParams["shard"];

    /**
     * See [[GatewayParams["nonce"]]].
     */
    nonce?: GatewayParams["nonce"];
}
