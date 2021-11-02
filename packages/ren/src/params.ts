import { RenVMShard } from "../../provider/build/main";

/**
 * The parameters for a cross-chain transfer onto Ethereum.
 */
export interface GatewayParams<
    FromPayload extends {
        chain: string;
    } = {
        chain: string;
    },
    ToPayload extends { chain: string } = {
        chain: string;
    },
> {
    /**
     * The asset being minted or burned - e.g. `"BTC"`.
     */
    asset: string;

    /**
     * The chain that the asset is native to - e.g. `Bitcoin()` for bridging the
     * asset `"BTC"`.
     */
    from: FromPayload;

    /**
     * The chain that the asset is being bridged to - e.g. `Ethereum(provider)`.
     */
    to: ToPayload;

    /**
     * A LockAndMint's gateway address can be forced to be unique by providing a
     * 32-byte nonce.
     *
     * The nonce should be passed is as a 32-byte Buffer or a 32-byte hex
     * string, with or without a "0x" prefix.
     *
     * It defaults to 0 (32 empty bytes).
     *
     * @warning If the nonce is lost between detecting a deposit and
     * submitting it to RenVM, the deposit's funds can't be recovered.
     * A nonce should only be provided if it's guaranteed to be stored in
     * persistent storage before a deposit address is shown to the user.
     *
     * @example
     * ```
     * nonce: Buffer.from(new Array(32)),
     * ```
     *
     * @example
     * ```
     * // Use a nonce based on the number of days since epoch, in order to
     * // generate a new deposit address each day.
     * nonce: new BN(Math.floor(Date.now() / 8.64e7))
     *          .toArrayLike(Buffer, "be", 32),
     * ```
     */
    nonce?: Buffer | string;

    shard?: RenVMShard;

    /**
     * Provide optional tags which can be used to look up transfers in the
     * lightnodes.
     */
    tags?: [string]; // Currently, only one tag can be provided.
}
