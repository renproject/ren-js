import 'react-app-polyfill/ie11';
import * as React from 'react';
import * as ReactDOM from 'react-dom';
import { WalletPickerModal, WalletPickerConfig } from '../src';
import {
  MultiwalletProvider,
  useMultiwallet,
} from '../src/MultiwalletProvider';
import { EthereumInjectedConnector } from '../../../lib/multiwallet/multiwallet-ethereum-injected-connector/src/index';
import { BinanceSmartChainInjectedConnector } from '../../../lib/multiwallet/multiwallet-binancesmartchain-injected-connector/src/index';

const options: WalletPickerConfig<any, string> = {
  chains: {
    ethereum: [
      {
        name: 'Metamask',
        logo: 'https://avatars1.githubusercontent.com/u/11744586?s=60&v=4',
        connector: new EthereumInjectedConnector({ debug: true }),
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

const WalletDemo: React.FC = () => {
  const context = useMultiwallet<any, any>();
  console.log(context);
  return (
    <div>
      {Object.entries(context.enabledChains).map(([chain, connector]) => (
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
    <MultiwalletProvider>
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
    </MultiwalletProvider>
  );
};

ReactDOM.render(<App />, document.getElementById('root'));
