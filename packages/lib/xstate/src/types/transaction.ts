import { RenNetwork } from "@renproject/interfaces";

export interface GatewayTransaction {
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

export interface GatewaySession<CustomParams = void> {
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
    customParams?: CustomParams; // can be provided for extra transaction data

    // manual timestamps
    createdAt?: number;
    updatedAt?: number;

    // Database specific
    created?: unknown;
    updated?: unknown;
}
