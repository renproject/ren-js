# `@renproject/multiwallet-ethereum-walletconnect-connector`

This package provides a connector for WalletConnect mobile wallets.

## Usage

```ts
new EthereumWalletConnectConnector({
    rpc: {
        // Note, many WalletConnect wallets don't support non-mainnet networks
        // Metamask Mobile has been tested and confirmed to work however
        42: `https://kovan.infura.io/v3/${process.env.REACT_APP_INFURA_KEY}`,
    },
    qrcode: true,
    debug: true,
});
```

### Parameters

| parameter | type                | description                              |
| --------- | ------------------- | ---------------------------------------- |
| debug     | boolean             | Print debug messages                     |
| rpc       | { integer: string } | A map of chain ids to Websocket RPC URLs |
| qrcode    | boolean             | Whether to show a qrcode modal           |
