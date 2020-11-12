import BigNumber from "bignumber.js";

import { DepositCommon, LockChain, MintChain } from "./chain";
import { EthArgs } from "./ethArgs";

export type BNInterface = { toString(x?: "hex"): string };
export type NumberValue = string | number | BigNumber | BNInterface;

export type RenTokens = string;

/**
 * The details required to create and/or submit a transaction to Ethereum.
 */
export interface ContractCall {
    /**
     * The address of the adapter smart contract.
     */
    sendTo: string;

    /**
     * The name of the function to be called on the Adapter contract.
     */
    contractFn: string;

    /**
     * The parameters to be passed to the adapter contract.
     */
    contractParams?: EthArgs;

    /**
     * Set transaction options:.
     */
    txConfig?: unknown;
}

/**
 * The parameters required for both minting and burning.
 */
export interface TransferParamsCommon {
    asset: string;

    /**
     * Provide the transaction hash returned from RenVM to continue a previous
     * mint.
     */
    txHash?: string;

    /**
     * An option to override the default nonce generated randomly.
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    LockTransaction = any,
    LockDeposit extends DepositCommon<LockTransaction> = DepositCommon<
        LockTransaction
    >,
    LockAddress = string,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    MintTransaction = any,
    MintAddress = string
> extends TransferParamsCommon {
    from: LockChain<LockTransaction, LockDeposit, LockAddress>;
    to: MintChain<MintTransaction, MintAddress>;
}

/**
 * BurnAndReleaseParams define the parameters for a cross-chain transfer away
 * from Ethereum.
 */
export interface BurnAndReleaseParams<
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    LockTransaction = any,
    LockDeposit extends DepositCommon<LockTransaction> = DepositCommon<
        LockTransaction
    >,
    LockAddress = string,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    MintTransaction = any,
    MintAddress = string
> extends TransferParamsCommon {
    // If a `txHash` is provided, `from` doesn't need to be provided.
    from: MintChain<MintTransaction, MintAddress>;
    to: LockChain<LockTransaction, LockDeposit, LockAddress>;

    /**
     * The hash of the burn transaction on Ethereum.
     */
    transaction?: MintTransaction;

    /**
     * The ID of the burn emitted in the contract log.
     */
    burnNonce?: Buffer | string | number;
}
