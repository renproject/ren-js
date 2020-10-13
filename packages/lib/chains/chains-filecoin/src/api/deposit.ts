export interface FilTransaction {
    cid: string;
    // to: string;
    amount: string; // 18 decimal places
    params: string; // base64
    confirmations: number;
    nonce: number;
}
