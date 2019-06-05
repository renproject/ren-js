export enum Category {
    Republic = "republic",
    RenEx = "renEx",
    Tokens = "tokens",
    Other = "other",
}

export interface ContractDetails {
    address: string;
    new?: true;
}

export interface NetworkData {
    name: string;
    chain: string;
    infura: string;
    etherscan: string;
    addresses: any;
}
