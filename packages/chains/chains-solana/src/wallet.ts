import { PublicKey, Transaction } from "@solana/web3.js";

// See @project-serum/sol-wallet-adapter
export type Wallet = {
    signTransaction(transaction: Transaction): Promise<Transaction>;
    publicKey: PublicKey;
};
