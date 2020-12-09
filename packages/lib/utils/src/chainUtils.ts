import { MintChainStatic } from "@renproject/interfaces";

export const utilsWithChainNetwork = <
    Utils extends MintChainStatic<Transaction, Address, Network>["utils"],
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    Transaction = any,
    Address = string,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    Network = any
>(
    utils: Utils,
    getClassNetwork: () => Network | undefined,
) => ({
    ...utils,
    addressIsValid: (
        address: Address,
        network?: Network | "mainnet" | "testnet",
    ) =>
        utils.addressIsValid(
            address,
            network || getClassNetwork() || "mainnet",
        ),

    addressExplorerLink: utils.addressExplorerLink
        ? (address: Address, network?: Network | "mainnet" | "testnet") =>
              // eslint-disable-next-line @typescript-eslint/no-non-null-assertion,@typescript-eslint/no-unnecessary-type-assertion
              utils.addressExplorerLink!(
                  address,
                  network || getClassNetwork() || "mainnet",
              )
        : undefined,

    transactionExplorerLink: utils.transactionExplorerLink
        ? (tx: Transaction, network?: Network | "mainnet" | "testnet") =>
              // eslint-disable-next-line @typescript-eslint/no-non-null-assertion,@typescript-eslint/no-unnecessary-type-assertion
              utils.transactionExplorerLink!(
                  tx,
                  network || getClassNetwork() || "mainnet",
              )
        : undefined,
});
