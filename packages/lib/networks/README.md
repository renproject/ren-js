# Contract Index

[renproject.github.io/contracts-ts/](https://renproject.github.io/contracts-ts/)

An index of smart contract addresses used by Ren, available as website and an npm package.

## `npm` usage

```js
import {
    renMainnet,
    renChaosnet,
    renTestnet,
    renDevnet,
} from "@renproject/networks";

console.log(renMainnet.addresses.GatewayRegistry);
```

## Deploying

To deploy the **front-end**: `yarn deploy`.

To deploy to **npm**: `yarn publish`.

## Preview

![Preview](./public/preview.png)
