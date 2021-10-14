export enum TerraNetwork {
    Tequila = "tequila-0004",
    Columbus = "columbus-4",
}

export interface TerraTransaction {
    hash: string;
    from: string;
    to: string;
    denomination: string;
    amount: string;
    memo: string;
    confirmations: number;
    messageIndex: number;
}

export interface TerraAPI {
    fetchDeposits: (
        address: string,
        network: TerraNetwork,
        memo?: string | undefined,
        page?: number,
    ) => Promise<TerraTransaction[]>;

    fetchDeposit: (
        hash: string,
        messageIndex: number,
        network: TerraNetwork,
    ) => Promise<TerraTransaction>;
}

export type TerraAddress = {
    address: string; // Terra address
    asset?: string; // Asset tied to the pHash in the memo.
};

export type TerraDeposit = {
    transaction: TerraTransaction;
    amount: string;
};

export const UNSUPPORTED_TERRA_NETWORK = `Terra is not supported by the current RenVM network.`;

export const transactionToDeposit = (transaction: TerraTransaction) => ({
    transaction,
    amount: transaction.amount,
});
