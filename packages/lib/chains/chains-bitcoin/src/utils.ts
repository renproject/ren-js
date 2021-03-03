import { validate } from "wallet-address-validator";

import BTCValidator from "wallet-address-validator/src/bitcoin_validator";

export const validateAddress = (
    address: string,
    asset: string,
    network: string,
) => {
    if (asset === "DGB") {
        const currency = {
            name: "digibyte",
            symbol: "dgb",
            addressTypes: { prod: ["1e", "3f"], testnet: ["7e", "8c"] },
            validator: BTCValidator,
            segwitHrp: network === "mainnet" ? "dgb" : "dgbt",
        };

        return currency.validator.isValidAddress(address, currency, network);
    }

    return validate(address, asset, network === "mainnet" ? "prod" : network);
};
