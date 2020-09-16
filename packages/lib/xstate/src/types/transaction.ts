import { RenNetwork } from "@renproject/interfaces";

export enum TransactionAwaitable {
    SRC_SETTLE = "src-settle", // Deposit detected, but unconfirmed
    REN_INIT = "ren-init", // Not currently used - for state between deposit confirmed but not submitted to renvm
    REN_SETTLE = "ren-settle", // Submitted to renVM, awaiting signature
    DEST_INIT = "dest-init", // Awaiting submission to destination chain
    DEST_SETTLE = "dest-settle", // Awaiting confirmation on destination chain
}

export interface GatewayTransaction {
    awaiting: TransactionAwaitable;
    destTxConfs?: number;
    destTxConfTarget?: number;
    destTxVOut?: string | number;
    destTxHash?: string;
    sourceTxAmount: number;
    sourceTxHash: string;
    sourceTxVOut?: string | number;
    sourceTxConfs: number;
    sourceTxConfTarget?: number;
    renResponse?: any;
    renSignature?: any;
    rawSourceTx: any;
}

// When minting,
// One gateway should not, but could, have multiple valid transactions
// One gateway could have transactions that get replaced
// The question is whether we want gateway "sessions", where multiple source txs
// get correlated with the gateway that spawned them, or if we want to instantiate
// new transactions for each deposit that is detected
// It also raises the question if gateways should be "sealeable",
// returning any funds sent to them if they have completed their transaction
export interface GatewaySession {
    id: string;
    type: "mint" | "burn";
    network: RenNetwork | "testnet" | "mainnet";
    sourceAsset: string;
    sourceNetwork: string;
    sourceConfsTarget?: number; // will be updated once detected
    destAddress: string;
    destNetwork: string;
    destConfsTarget?: number; // FIXME: has to be set manually
    destAsset: string;
    targetAmount: string | number; // How much the user expects to recieve in destAsset
    userAddress: string; // Address that can cryptographically be proven to belong to a user

    suggestedAmount?: string | number; // Amount of sourceAsset user is suggested to send
    error?: Error; // Latest error detected during processing
    nonce?: any;

    gatewayAddress?: string;
    expiryTime: number; // unix time when address will no longer accept deposits
    transactions: { [key in string]: GatewayTransaction };

    // manual timestamps
    createdAt?: number;
    updatedAt?: number;

    // Database specific
    created?: unknown;
    updated?: unknown;
}
