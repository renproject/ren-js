# RenJS package list

## `./lib`

-   [`ren`](./lib/ren) - Javascript SDK for interacting with RenVM.
-   [`rentx`](./lib/rentx) - Transaction state management library.
-   [`interfaces`](./lib/interfaces) - Typescript definitions.
-   [`provider`](./lib/provider) - JSON-RPC provider.
-   [`networks`](./lib/networks) - Definition of RenVM's mainnet and testnet networks.
-   [`utils`](./lib/utils) - Helper functions used by the other packages.
-   [`rpc`](./lib/rpc) - RenVM-specific JSON-RPC definitions.
-   [`test`](./lib/test) - Integration tests.
-   chains - Packages for adding support for blockchains and assets.
-   -   [`chains-bitcoin`](./lib/chains/chains-bitcoin)
-   -   [`chains-terra`](./lib/chains/chains-terra)
-   -   [`chains-filecoin`](./lib/chains/chains-filecoin)
-   -   [`chains-ethereum`](./lib/chains/chains-ethereum)
-   -   [`chains`](./lib/chains/chains)
-   multiwallet - Connectors for [`multiwallet-ui`](..lib//ui/multiwallet-ui)
-   -   [`multiwallet-base-connector`](./lib/multiwallet/multiwallet-base-connector)
-   -   [`multiwallet-abstract-ethereum-connector`](./lib/multiwallet/multiwallet-abstract-ethereum-connector)
-   -   [`multiwallet-ethereum-injected-connector`](./lib/multiwallet/multiwallet-ethereum-injected-connector)
-   -   [`multiwallet-binancesmartchain-injected-connector`](./lib/multiwallet/multiwallet-binancesmartchain-injected-connector)
-   -   [`multiwallet-ethereum-walletconnect-connector`](./lib/multiwallet/multiwallet-ethereum-walletconnect-connector)
-   -   [`multiwallet-ethereum-mewconnect-connector`](./lib/multiwallet/multiwallet-ethereum-mewconnect-connector)

## `./ui`

-   [`multiwallet-ui`](./ui/multiwallet-ui) - Wallet connection library
