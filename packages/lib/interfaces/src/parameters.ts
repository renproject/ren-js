/* eslint-disable @typescript-eslint/no-explicit-any */
import BigNumber from "bignumber.js";

import { DepositCommon, LockChain, MintChain } from "./chain";
import { EthArgs } from "./ethArgs";

export type BNInterface = { toString(x?: "hex"): string };
export type NumberValue = string | number | BigNumber | BNInterface;

export type RenTokens = string;

/**
 * The details required to create and/or submit a transaction to a chain.
 */
export interface ContractCall {
    /**
     * The address of the contract.
     */
    sendTo: string;

    /**
     * The name of the function to be called on the contract.
     */
    contractFn: string;

    /**
     * The parameters to be passed to the contract. They can only be defined
     * using Ethereum types currently.
     */
    contractParams?: EthArgs;

    /**
     * Override chain-specific transaction configuration, such as gas/fees.
     */
    txConfig?: unknown;
}

/**
 * The parameters required for both minting and burning.
 */
export interface TransferParamsCommon {
    /**
     * The asset being minted or burned - e.g. `"BTC"`.
     */
    asset: string;

    /**
     * A RenVM transaction hash, which can be used to resume an existing mint
     * or burn.
     */
    txHash?: string;

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
     *
     * @example
     * ```
     * // Provide a random 32-byte Buffer. It's important that this isn't lost.
     * nonce: RenJS.utils.randomNonce(),
     * ```
     */
    nonce?: Buffer | string;

    /**
     * Provide optional tags which can be used to look up transfers in the
     * lightnodes.
     */
    tags?: [string]; // Currently, only one tag can be provided.

    /**
     * Details for submitting one or more transactions. The last one will be
     * used by the lockAndMint or burnAndRelease.
     * For minting, the last call's parameters will be augmented with the three
     * required parameters for minting - the amount, nHash and RenVM signature.
     * For burning, the last call must involve ren-assets being burnt.
     */
    contractCalls?: ContractCall[];
}

/**
 * The parameters for a cross-chain transfer onto Ethereum.
 */
export interface LockAndMintParams<
    LockTransaction = any,
    LockDeposit extends DepositCommon<LockTransaction> = DepositCommon<LockTransaction>,
    LockAddress extends string | { address: string } = any,
    MintTransaction = any,
    MintAddress extends string | { address: string } = any,
> extends TransferParamsCommon {
    /**
     * The chain that the asset is native to - e.g. `Bitcoin()` for bridging the
     * asset `"BTC"`.
     */
    from: LockChain<LockTransaction, LockDeposit, LockAddress>;

    /**
     * The chain that the asset is being bridged to - e.g. `Ethereum(provider)`.
     */
    to: MintChain<MintTransaction, MintAddress>;
}

/**
 * BurnAndReleaseParams define the parameters for a cross-chain transfer away
 * from Ethereum.
 */
export interface BurnAndReleaseParams<
    LockTransaction = any,
    LockDeposit extends DepositCommon<LockTransaction> = DepositCommon<LockTransaction>,
    LockAddress extends string | { address: string } = any,
    MintTransaction = any,
    MintAddress extends string | { address: string } = any,
> extends TransferParamsCommon {
    /**
     * The chain from which the ren-asset was burned - e.g. `Ethereum(provider)`.
     */
    from: MintChain<MintTransaction, MintAddress>;

    /**
     * The asset's native chain to which it's being returned - e.g. `Bitcoin()`
     * for the asset `"BTC"`.
     */
    to: LockChain<LockTransaction, LockDeposit, LockAddress>;

    /**
     * The hash of the burn transaction on the MintChain.
     */
    transaction?: MintTransaction;

    /**
     * The unique identifier of the burn emitted from the event on the MintChain.
     */
    burnNonce?: Buffer | string | number;
}
