# RenJS Docs

These are automatically generated docs for RenJS's interfaces, hosted at [renproject.github.io/ren-js-docs](https://renproject.github.io/ren-js-docs/).

See [https://renproject.github.io/ren-client-docs/ren-js](https://https://renproject.github.io/ren-client-docs/ren-js) for more docs and tutorials.

### RenJS - @renproject/ren

-   [[RenJS]]

    -   [[RenJS.lockAndMint]] - for minting ren-assets, e.g. bridging BTC onto Ethereum as renBTC.
        RenJS.lockAndMint returns a [[LockAndMint]] object, and each deposit creates a [[LockAndMintDeposit]].

    -   [[RenJS.burnAndRelease]] - for returning assets to their native chains - e.g. burning renBTC back to BTC.
        RenJS.burnAndRelease returns a [[BurnAndRelease]] object.

### Chains

The package `@renproject/ren` doesn't come with support for any chains - they must be imported separately, either
individually - e.g. `@renproject/chains-bitcoin` - or using `@renproject/chains`, which combines several chains
packages.

For docs on each chain, see:

`@renproject/chains-bitcoin`:

-   [[BitcoinClass]]
-   [[ZcashClass]]
-   [[BitcoinCashClass]]

`@renproject/chains-filecoin`:

-   [[FilecoinClass]]

`@renproject/chains-ethereum`:

-   [[EthereumClass]]
-   [[BinanceSmartChainClass]]

### RenTX

See the [RenTX README](https://github.com/renproject/ren-js/tree/feat/2.0.0-alpha.21/packages/lib/rentx).

-   [[mintMachine]]
-   [[burnMachine]]

### MultiWallet

See the [MultiWallet README](https://github.com/renproject/ren-js/tree/feat/2.0.0-alpha.21/packages/ui/multiwallet-ui).

-   [[WalletPicker]]
