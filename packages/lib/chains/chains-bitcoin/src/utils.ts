import { validate } from "wallet-address-validator";

export const validateAddress = (
    address: string,
    asset: string,
    network: string,
) => validate(address, asset, network === "mainnet" ? "prod" : network);
