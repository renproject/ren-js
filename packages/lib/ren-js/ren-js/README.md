# Official Ren SDK

The official Javascript SDK for interacting with [Ren](https://renproject.io).

## Links

* [Official SDK Docs](https://app.gitbook.com/@renproject/s/developers)
* [Cloneable Examples](https://github.com/republicprotocol/dex-demo)

## Installation

Add the RenSDK using Yarn/npm:

```bash
yarn add @renproject/ren
```
or
```bash
npm install --save @renproject/ren
```

## Importing the SDK

Importing using the require syntax

```javascript
var { RenSDK } = require("@renproject/ren");
```

Importing using the ES6 syntax

```javascript
import { RenSDK } from "@renproject/ren";
```

## Usage

```javascript
const web3 =  window.web3;
var sdk = new RenSDK(web3);
```

<hr />

## Dev

### Building

```bash
yarn run watch
# or
yarn run build:dev
```

### Tests

You'll need to create a `.env` file which contains the following exported variables:

```bash
export MNEMONIC="some mnemonic here"
export ETHEREUM_NODE="ethereum node url (e.g. Infura)"
```

Then just run the following command to execute the tests. Make sure there is sufficient Kovan ETH in the linked account before running tests.

```bash
yarn run test
```

### Update Typescript bindings

In order to update the bindings in `src/contracts/bindings`, you need to clone [`darknode-sol`](https://github.com/renproject/darknode-sol) and run:

```bash
yarn run bindings:ts
```
