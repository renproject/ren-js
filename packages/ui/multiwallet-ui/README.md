# Multiwallet UI

This package provides a React wallet selection modal and state management for Multiwallet connectors.

## Usage
```bash
yarn add @renproject/multiwallet-ui
# For each chain / connector
yarn add @renproject/multiwallet-{DESIRED_CHAIN}-{DESIRED_WALLET}-conector
# Ensure peer dependencies are installed
```

At the root of your app, add the provider
```ts
import React from "react";
import ReactDOM from "react-dom";

import { MultiwalletProvider } from "@renproject/multiwallet-ui";
import App from "./App";

ReactDOM.render(
  <MultiwalletProvider>
    <App/>
  </MultiwalletProvider>,
  document.getElementById("root")
)
```

In your app, configure the desired providers for their chains eg.
```ts
import { EthereumInjectedConnector } from '@renproject/multiwallet-ethereum-injected-connector';
import { EthereumWalletConnectConnector } from '@renproject/multiwallet-ethereum-walletconnect-connector';
import { BinanceSmartChainInjectedConnector } from '@renproject/multiwallet-binancesmartchain-injected-connector';

const options = {
  chains: {
    ethereum: [
      {
        name: 'Metamask',
        logo: 'https://avatars1.githubusercontent.com/u/11744586?s=60&v=4',
        connector: new EthereumInjectedConnector({ debug: true }),
      },
      {
        name: 'WalletConnect',
        logo: 'https://avatars0.githubusercontent.com/u/37784886?s=60&v=4',
        connector: new EthereumWalletConnectConnector({
          rpc: {
            42: `https://kovan.infura.io/v3/${process.env.INFURA_KEY}`,
          },
          qrcode: true,
          debug: true,
        }),
      },
    ],
    bsc: [
      {
        name: 'BinanceSmartWallet',
        logo: 'https://avatars2.githubusercontent.com/u/45615063?s=60&v=4',
        connector: new BinanceSmartChainInjectedConnector({ debug: true }),
      },
    ],
  },
};
```

Finally, render the modal use the `useMultiwallet` hook to request a connection to the chain.

```tsx
import * as React from 'react';
import { WalletPickerModal, useMultiwallet } from '@renproject/multiwallet-ui';
// import options object

const WalletDemo: React.FC = () => {
  const {enabledChains} = useMultiwallet();
  return (
    <div>
      {Object.entries(enabledChains).map(([chain, connector]) => (
        <span key={chain}>
          {chain}: Status {connector.status} to {connector.account}
        </span>
      ))}
    </div>
  );
};

const App = () => {
  const [open, setOpen] = React.useState(false);
  const [chain, setChain] = React.useState('');
  const setClosed = React.useMemo(() => () => setOpen(false), [setOpen]);

  return (
    <>
      <WalletDemo />
      <button
        onClick={() => {
          setChain('ethereum');
          setOpen(true);
        }}
      >
        Request Ethereum
      </button>
      <button
        onClick={() => {
          setChain('bsc');
          setOpen(true);
        }}
      >
        Request BSC
      </button>
      <WalletPickerModal
        open={open}
        close={setClosed}
        options={{ chain, close: setClosed, config: options }}
      />
    </>
  );
};
```

See the `/example` directory for a working example, or check the storybook as detailed below for further usage guides.

## Developing
### Commands

TSDX scaffolds your new library inside `/src`, and also sets up a [Parcel-based](https://parceljs.org) playground for it inside `/example`.

The recommended workflow is to run TSDX in one terminal:

```bash
npm start # or yarn start
```

This builds to `/dist` and runs the project in watch mode so any edits you save inside `src` causes a rebuild to `/dist`.

Then run either Storybook or the example playground:

#### Storybook

Run inside another terminal:

```bash
yarn storybook
```

This loads the stories from `./stories`.

> NOTE: Stories should reference the components as if using the library, similar to the example playground. This means importing from the root project directory. This has been aliased in the tsconfig and the storybook webpack config as a helper.

#### Example

Then run the example inside another:

```bash
cd example
npm i # or yarn to install dependencies
npm start # or yarn start
```

The default example imports and live reloads whatever is in `/dist`, so if you are seeing an out of date component, make sure TSDX is running in watch mode like we recommend above. **No symlinking required**, we use [Parcel's aliasing](https://parceljs.org/module_resolution.html#aliases).

To do a one-off build, use `npm run build` or `yarn build`.

To run tests, use `npm test` or `yarn test`.

### Configuration

Code quality is set up for you with `prettier`, `husky`, and `lint-staged`. Adjust the respective fields in `package.json` accordingly.

#### Jest

Jest tests are set up to run with `npm test` or `yarn test`.

#### Bundle analysis

Calculates the real cost of your library using [size-limit](https://github.com/ai/size-limit) with `npm run size` and visulize it with `npm run analyze`.

##### Setup Files

This is the folder structure we set up for you:

```txt
/example
  index.html
  index.tsx       # test your component here in a demo app
  package.json
  tsconfig.json
/src
  index.tsx       # EDIT THIS
/test
  blah.test.tsx   # EDIT THIS
/stories
  Thing.stories.tsx # EDIT THIS
/.storybook
  main.js
  preview.js
.gitignore
package.json
README.md         # EDIT THIS
tsconfig.json
```

#### Rollup

TSDX uses [Rollup](https://rollupjs.org) as a bundler and generates multiple rollup configs for various module formats and build settings. See [Optimizations](#optimizations) for details.

#### TypeScript

`tsconfig.json` is set up to interpret `dom` and `esnext` types, as well as `react` for `jsx`. Adjust according to your needs.

### Continuous Integration

#### GitHub Actions

Two actions are added by default:

- `main` which installs deps w/ cache, lints, tests, and builds on all pushes against a Node and OS matrix
- `size` which comments cost comparison of your library on every pull request using [size-limit](https://github.com/ai/size-limit)

### Module Formats

CJS, ESModules, and UMD module formats are supported.

The appropriate paths are configured in `package.json` and `dist/index.js` accordingly. Please report if any issues are found.

### Named Exports

Per Palmer Group guidelines, [always use named exports.](https://github.com/palmerhq/typescript#exports) Code split inside your React app instead of your React library.

