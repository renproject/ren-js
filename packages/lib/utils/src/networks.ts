import { RenNetwork } from "@renproject/interfaces";

export const stringToNetwork = (
    network?: RenNetwork | string | null | undefined
): RenNetwork => {
    if (typeof network === "string") {
        switch (network.toLowerCase()) {
            case "":
            case "mainnet":
                return RenNetwork.Mainnet;
            case "chaosnet":
                return RenNetwork.Chaosnet;
            case "testnet":
                return RenNetwork.Testnet;
            case "devnet":
                return RenNetwork.Devnet;
        }
        // tslint:disable-next-line: strict-type-predicates
    } else if (network === undefined || network === null) {
        return RenNetwork.Mainnet;
    }
    throw new Error(`Unsupported network "${network}"`);
};
