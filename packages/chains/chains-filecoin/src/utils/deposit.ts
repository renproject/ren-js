export enum FilNetwork {
    Mainnet = "mainnet",
    Testnet = "testnet",
}

export interface FilTransaction {
    cid: string;

    amount: string; // 18 decimal places
    params: string; // base64
    confirmations: number;
    nonce: number;

    reverted?: boolean;
}

export interface FilExplorer {
    fetchDeposits: (
        address: string,
        params?: string | undefined,
        page?: number,
    ) => Promise<FilTransaction[]>;
}
