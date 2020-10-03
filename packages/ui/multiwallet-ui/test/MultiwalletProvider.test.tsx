import React, { useEffect } from 'react';
import {
  MultiwalletProvider,
  useMultiwallet,
} from '../src/MultiwalletProvider';
import {
  ConnectorEmitter,
  ConnectorEvents,
  ConnectorInterface,
} from '@renproject/multiwallet-base-connector';
import * as ReactDOM from 'react-dom';
import { act, Simulate } from 'react-dom/test-utils';
import { RenNetwork } from '@renproject/interfaces';

const emitter = new ConnectorEmitter(false);

let mockConnector: ConnectorInterface<any, any> = {
  activate: () => new Promise(() => {}),
  supportsTestnet: true,
  getProvider: async () => {},
  getAccount: async () => {},
  deactivate: async () => {},
  getRenNetwork: async () => RenNetwork.Testnet,
  emitter,
};

const TestAutoActivate: React.FC<{
  chain: string;
  connector: ConnectorInterface<any, any>;
}> = ({ chain, connector }) => {
  const { activateConnector, enabledChains } = useMultiwallet();
  useEffect(() => {
    // Don't automatically re-connect on disconnection
    if (enabledChains[chain]?.status === 'disconnected') return;
    activateConnector(chain, connector);
  }, [activateConnector, chain, connector, enabledChains]);
  const enabledChain = enabledChains[chain];

  return (
    <div>
      {enabledChain?.status} {enabledChain?.account}
      {enabledChain?.error?.message}
    </div>
  );
};

const TestManualActivate: React.FC<{
  chain: string;
  id: string;
  connector: ConnectorInterface<any, any>;
}> = ({ chain, connector, id }) => {
  const { activateConnector, enabledChains } = useMultiwallet();
  const enabledChain = enabledChains[chain];
  const activate = React.useCallback(() => {
    console.log('clicked');
    activateConnector(chain, connector);
  }, [activateConnector, chain, connector]);

  return (
    <div>
      <button id={id} onClick={activate}>
        Activate
      </button>
      {enabledChain?.status} {enabledChain?.account}
      {enabledChain?.error?.message}
    </div>
  );
};

describe('MultiwalletProvider', () => {
  beforeEach(() => {
    mockConnector = {
      activate: () => new Promise(() => {}),
      supportsTestnet: true,
      getProvider: async () => {},
      getAccount: async () => {},
      deactivate: async () => {},
      getRenNetwork: async () => RenNetwork.Testnet,
      emitter,
    };
  });
  it('Starts connecting when activateConnector is called', async (done) => {
    const div = document.createElement('div');
    await act(async () =>
      ReactDOM.render(
        <MultiwalletProvider>
          <TestAutoActivate chain="chain1" connector={{ ...mockConnector }} />
        </MultiwalletProvider>,
        div
      )
    );

    setTimeout(() => {
      expect(div.innerHTML).toContain('connecting');
      ReactDOM.unmountComponentAtNode(div);
      done();
    }, 100);
  });

  it('It correctly updates to the connected state', async (done) => {
    const div = document.createElement('div');
    mockConnector.activate = async () => ({
      account: 'test',
      provider: {},
      renNetwork: RenNetwork.Testnet,
    });
    await act(async () =>
      ReactDOM.render(
        <MultiwalletProvider>
          <TestAutoActivate chain="chain2" connector={{ ...mockConnector }} />
        </MultiwalletProvider>,
        div
      )
    );

    setTimeout(() => {
      expect(div.innerHTML).toContain('connected');
      ReactDOM.unmountComponentAtNode(div);
      done();
    }, 1000);
  });

  it('It correctly handles disconnection events', async (done) => {
    const div = document.createElement('div');
    mockConnector.activate = async () => ({
      account: 'test',
      provider: {},
      renNetwork: RenNetwork.Testnet,
    });
    await act(async () =>
      ReactDOM.render(
        <MultiwalletProvider>
          <TestAutoActivate chain="chain2" connector={{ ...mockConnector }} />
        </MultiwalletProvider>,
        div
      )
    );

    setTimeout(async () => {
      await act(async () => {
        mockConnector.emitter.emit(ConnectorEvents.DEACTIVATE, 'testing');
      });
    }, 1000);

    setTimeout(() => {
      expect(div.innerHTML).toContain('disconnected');
      ReactDOM.unmountComponentAtNode(div);
      done();
    }, 2000);
  });

  it('It correctly handles update events', async (done) => {
    const div = document.createElement('div');
    mockConnector.activate = async () => ({
      account: 'test',
      provider: {},
      renNetwork: RenNetwork.Testnet,
    });
    await act(async () =>
      ReactDOM.render(
        <MultiwalletProvider>
          <TestAutoActivate chain="chain2" connector={{ ...mockConnector }} />
        </MultiwalletProvider>,
        div
      )
    );

    setTimeout(async () => {
      await act(async () => {
        mockConnector.emitter.emit(ConnectorEvents.UPDATE, {
          account: 'newAccount',
        });
      });
    }, 1000);

    setTimeout(() => {
      expect(div.innerHTML).toContain('newAccount');
      ReactDOM.unmountComponentAtNode(div);
      done();
    }, 2000);
  });

  it('It correctly handles error events', async (done) => {
    const div = document.createElement('div');
    mockConnector.activate = async () => ({
      account: 'test',
      provider: {},
      renNetwork: RenNetwork.Testnet,
    });
    await act(async () =>
      ReactDOM.render(
        <MultiwalletProvider>
          <TestAutoActivate chain="chain2" connector={{ ...mockConnector }} />
        </MultiwalletProvider>,
        div
      )
    );

    setTimeout(async () => {
      await act(async () => {
        mockConnector.emitter.emit(
          ConnectorEvents.ERROR,
          new Error('an error')
        );
      });
    }, 1000);

    setTimeout(() => {
      expect(div.innerHTML).toContain('disconnected');
      expect(div.innerHTML).toContain('an error');
      ReactDOM.unmountComponentAtNode(div);
      done();
    }, 2000);
  });

  it('It correctly handles connecting with different connectors', async (done) => {
    const div = document.createElement('div');
    mockConnector.activate = async () => ({
      account: 'test',
      provider: {},
      renNetwork: RenNetwork.Testnet,
    });
    await act(async () =>
      ReactDOM.render(
        <MultiwalletProvider>
          <TestManualActivate
            chain="manualChain"
            id="1"
            connector={{ ...mockConnector }}
          />
          <TestManualActivate
            chain="manualChain"
            id="2"
            connector={{ ...mockConnector }}
          />
        </MultiwalletProvider>,
        div
      )
    );

    await act(async () => {
      const button = div.querySelectorAll('button').item(0);
      if (!button) return;
      Simulate.click(button);
    });

    setTimeout(async () => {
      await act(async () => {
        const button = div.querySelectorAll('button').item(1);
        if (!button) return;
        Simulate.click(button);
      });
    }, 1000);

    setTimeout(() => {
      expect(div.innerHTML).toContain('connected');
      ReactDOM.unmountComponentAtNode(div);
      done();
    }, 4900);
  });
});
