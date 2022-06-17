# `🛠️ ren-js`

[![Version](https://img.shields.io/npm/v/@renproject/ren)](https://www.npmjs.com/package/@renproject/ren)

The official Javascript SDK for interacting with [RenVM](https://renproject.io).

```sh
yarn add @renproject/ren @renproject/chains
```

## Docs

See [Ren Client Docs](https://renproject.github.io/ren-client-docs/ren-js/)

## RenJS v3

RenJS v3 is currently available as an alpha release:

```sh
yarn add @renproject/ren @renproject/chains
```

[RenJS v3 Docs](https://renproject.github.io/ren-client-docs/ren-js/ren-js-v3) (WIP)

## Changelog

See the [Releases page](https://github.com/renproject/ren-js/releases).

## Package list

-   [`ren`](./packages/ren) - Javascript SDK for interacting with RenVM.
-   [`provider`](./packages/provider) - JSON-RPC provider.
-   [`utils`](./packages/utils) - Helper functions used by the other packages.
-   [`mock-provider`](./packages/mock-provider) - For testing locally with Ganache/Hardhat
-   chains, for enabling support for blockchains and assets:
-   -   [`chains-bitcoin`](./packages/chains/chains-bitcoin) - Bitcoin and Bitcoin forks
-   -   [`chains-ethereum`](./packages/chains/chains-ethereum) - Ethereum and other EVM chains
-   -   [`chains-terra`](./packages/chains/chains-terra) - Terra/LUNA
-   -   [`chains-filecoin`](./packages/chains/chains-filecoin) - Filecoin
-   -   [`chains-solana`](./packages/chains/chains-solana) - Solana
-   -   [`chains`](./packages/chains/chains) - Combines all of the above chains into one package

<hr />

<details>
<summary>Developer docs - click to expand</summary>

<br />

## Developing locally

```sh
# Clone repository
git clone git@github.com:renproject/ren-js.git && cd ren-js

# Install dependencies
yarn

# Build every package
yarn run build
```

## Linking

If you want to use your local version of RenJS in another repository, run

```sh
# In the ren-js repository
yarn run link:all
```

You can now link it to any other local repository by running:

```sh
# In other local repositories
yarn link @renproject/ren @renproject/chains @renproject/utils @renproject/provider
```

## Running tests

You'll need to:

1. Generate a mnemonic and send ETH (kovan for testnet) (path: `m/44'/60'/0'/0/`).
    - `let w = require("ethers").Wallet.createRandom(); console.debug(w.address, w.mnemonic.phrase);`
2. Generate a private key and send testnet crypto funds.
    - `require("send-crypto").newPrivateKey();`
3. Optionally generate an [Infura](https://infura.io) API key.

Create a `.env` file which contains the following exported variables:

```sh
export MNEMONIC="your mnemonic here"
export TESTNET_PRIVATE_KEY="your bitcoin private key"

# Optional
export INFURA_KEY="your infura key"
```

To run the tests:

```sh
yarn run test
```

</details>
