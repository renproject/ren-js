import {
    BurnAndReleaseTransaction,
    DepositCommon,
    RenNetwork,
} from "@renproject/interfaces";

export type AllBurnTransactions<BurnType, ReleaseType> =
    | ConfirmedBurnTransaction<BurnType>
    | ReleasedBurnTransaction<BurnType>
    | BurnTransaction
    | CompletedBurnTransaction<BurnType, ReleaseType>;

export const isBurnConfirmed = <X, Y>(
    x: AllBurnTransactions<X, Y>,
): x is ConfirmedBurnTransaction<X> => {
    return (x as ConfirmedBurnTransaction<X>).renVMHash !== undefined;
};

export interface ConfirmedBurnTransaction<BurnType> extends BurnTransaction {
    /* Hash of renVM transaction */
    renVMHash: string;

    /**
     * Underlying source chain tx
     */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    rawSourceTx: DepositCommon<BurnType>;
}

export const isReleased = <X, Y>(
    x: AllBurnTransactions<X, Y>,
): x is ReleasedBurnTransaction<X> => {
    return (x as ReleasedBurnTransaction<X>).renResponse !== undefined;
};

export interface ReleasedBurnTransaction<BurnType>
    extends ConfirmedBurnTransaction<BurnType> {
    /**
     * Response to renvm release request
     */
    renResponse: BurnAndReleaseTransaction;
    destTxHash?: string;
}

export const isBurnCompleted = <X, Y>(
    x: AllBurnTransactions<X, Y>,
): x is CompletedBurnTransaction<X, Y> => {
    return (x as CompletedBurnTransaction<X, Y>).completedAt !== undefined;
};

export interface CompletedBurnTransaction<BurnType, ReleaseType>
    extends ReleasedBurnTransaction<BurnType> {
    /**
     * Unix time when mint was successful
     */
    completedAt: Number;

    /* Hash of output transaction */
    destTxHash: string;
    /**
     * Underlying dest chain tx
     */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    rawDestTx: ReleaseType;

    /**
     * Transaction amount in the minimum denomination (eg. SATs for Bitcoin)
     */
    destTxAmount: string;
}

/**
 * A pair of transactions from a sourceChain to a destChain
 */
export interface BurnTransaction {
    /**
     * Transaction amount in the minimum denomination (eg. SATs for Bitcoin)
     */
    sourceTxAmount: string;
    /**
     * The RenVM Tx hash when minting,
     * The host chain burn tx hash when burning
     */
    sourceTxHash: string;
    /**
     * Current confirmations on source transaction
     */
    sourceTxConfs: number;
    /**
     * How many confirmations needed to consider the source tx accepted
     */
    sourceTxConfTarget: number;
    /**
     * Latest error detected during processing a specific transaction
     */
    error?: Error;

    /**
     * Unix time when deposit was first detected
     */
    detectedAt: Number;
}

/**
 * A Burn Session represents the parameters used to create a Burn Address
 * that can recieve assets to mint on RenVM; or construct the parameters required
 * for burning and releasing from RenVM
 */
export interface BurnSession<BurnType, ReleaseType, CustomParams = {}> {
    /**
     * A unique ID to identify the session
     */
    id: string;
    /**
     * Ren network version to be used, which determines network versions for the selected chains
     */
    network: RenNetwork | "testnet" | "mainnet";
    /**
     * Asset to be minted (on native chain)
     */
    sourceAsset: string;
    /**
     * Chain that the source asset is located on
     */
    sourceChain: string;
    /**
     * Transaction amount in the minimum denomination (eg. SATs for Bitcoin)
     */
    targetAmount: string;
    /**
     * Address that will recieve the asset
     */
    destAddress: string;
    /**
     * Chain that the asset will be recieved on
     */
    destChain: string;
    /**
     * Address that can cryptographically be proven to belong to a user
     */
    userAddress: string;

    /**
     * Transactions detected for this session, indexed by their sourceTxHash
     */
    transaction?: AllBurnTransactions<BurnType, ReleaseType>;

    /**
     * Extra parameters to be used for constructing to/from contract parameters
     */
    customParams: CustomParams;

    /**
     * Optional timestamp
     */
    createdAt?: number;

    /**
     * Optional timestamp
     */
    updatedAt?: number;
}

export interface ErroringBurnSession<DepositType, CustomParams = {}>
    extends BurnSession<DepositType, CustomParams> {
    /**
     * Latest error detected during processing
     */
    error: Error;
}

export const isBurnErroring = <X, Y>(
    x: ErroringBurnSession<X> | BurnSession<X, Y>,
): x is ErroringBurnSession<X> => {
    return (x as ErroringBurnSession<X>).error !== undefined;
};
