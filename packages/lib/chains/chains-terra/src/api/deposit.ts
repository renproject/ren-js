import { RenNetwork } from "@renproject/interfaces";

export enum TerraNetwork {
    Tequila = "tequila-0004",
    Columbus = "columbus-3",
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
        memo: string | undefined,
        page?: number,
    ) => Promise<TerraTransaction[]>;

    fetchDeposit: (
        hash: string,
        messageIndex: number,
        network: TerraNetwork,
    ) => Promise<TerraTransaction>;
}

export enum TerraAsset {
    LUNA = "LUNA",
}
export type TerraAddress = {
    address: string; // Terra address
    asset?: TerraAsset; // Asset tied to the pHash in the memo.
    memo?: string; // Base64 string of the pHash.
};
export type TerraDeposit = {
    transaction: TerraTransaction;
    amount: string;
};

export const UNSUPPORTED_TERRA_NETWORK = `Terra is not supported by the current RenVM network.`;

export const resolveTerraNetwork = (renNetwork: RenNetwork): TerraNetwork => {
    switch (renNetwork) {
        case RenNetwork.Mainnet:
        case RenNetwork.Chaosnet:
            return TerraNetwork.Columbus;
        case RenNetwork.Testnet:
        case RenNetwork.Devnet:
            return TerraNetwork.Tequila;
        case RenNetwork.Localnet:
            throw new Error(`Terra is currently not supported on localnet.`);
    }
    throw new Error(`Unrecognized network ${renNetwork}`);
};

export const transactionToDeposit = (transaction: TerraTransaction) => ({
    transaction,
    amount: transaction.amount,
});
