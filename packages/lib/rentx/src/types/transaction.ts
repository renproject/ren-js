import {
    BurnTransaction,
    DepositCommon,
    MintTransaction,
    RenNetwork,
} from "@renproject/interfaces";

export interface GatewayTransaction {
    destTxConfs?: number; // Current number of confirmations on destination chain transaction
    destTxConfTarget?: number; // Number of txs on the destination chain before the asset is released
    destTxHash?: string; // Hash of output transaction
    sourceTxAmount: number; // Transaction amount pre decimalization
    sourceTxHash: string;
    sourceTxConfs: number; // Current confirmations on source transaction
    sourceTxConfTarget?: number; // How many confirmations needed to consider the source tx accepted
    renResponse?: MintTransaction | BurnTransaction; // Response to renvm signing request
    renSignature?: any;
    rawSourceTx: DepositCommon<any>; // underlying source chain tx
}

export interface GatewaySession<CustomParams = any> {
    id: string;
    type: "mint" | "burn"; // Whether an asset is being locked and minted (mint), or burned and released (burn)
    network: RenNetwork | "testnet" | "mainnet"; // Ren network version to be used, which determines network versions for the selected chains
    sourceAsset: string; // Asset to be minted/burned
    sourceNetwork: string; // Chain that the source asset is located on
    sourceConfsTarget?: number; // will be updated once detected
    destAddress: string; // Address that will recieve the asset
    destNetwork: string; // Chain that the asset will be recieved on
    destConfsTarget?: number; // FIXME: has to be set manually
    targetAmount: string | number; // How much the user expects to recieve in destAsset
    userAddress: string; // Address that can cryptographically be proven to belong to a user

    suggestedAmount?: string | number; // Amount of sourceAsset user is suggested to send
    error?: Error; // Latest error detected during processing
    nonce?: any;

    gatewayAddress?: string; // Generated address on the source chain where assets should be sent to for a mint transaction
    expiryTime: number; // unix time when gateway address will no longer accept deposits
    transactions: { [key in string]: GatewayTransaction }; // Transactions detected for this session
    customParams: CustomParams; // can be provided for extra transaction data

    // manual timestamps
    createdAt?: number;
    updatedAt?: number;
}
