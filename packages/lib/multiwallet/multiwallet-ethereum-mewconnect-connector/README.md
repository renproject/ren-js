# `@renproject/multiwallet-ethereum-mewconnect-connector`

This package provides a connector for the MEW mobile application

## Usage

```ts
new EthereumMEWConnectConnector({
    rpc: {
        1: `wss://mainnet.infura.io/ws/v3/${process.env.REACT_APP_INFURA_KEY}`,
    },
    chainId: 1,
    debug: true,
});
```

Note, must be served on an HTTPS connection in order to work, so local-host testing can be problematic.

### Parameters

| parameter | type                | description                                        |
| --------- | ------------------- | -------------------------------------------------- |
| debug     | boolean             | Print debug messages                               |
| chainId   | integer             | Which chain to connect to (currently Mainnet only) |
| rpc       | { integer: string } | A map of chain ids to Websocket RPC URLs           |
