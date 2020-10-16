import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react';
import {
  ConnectorInterface,
  ConnectorEvents,
} from '@renproject/multiwallet-base-connector';
import { RenNetwork } from '@renproject/interfaces';

interface MultiwalletConnector<P, A> {
  connector: ConnectorInterface<P, A>;
  provider?: P;
  account?: A;
  error?: Error;
  chain: string;
  status: 'connecting' | 'connected' | 'disconnected' | 'wrong_network';
  // name: string;
}

export interface MultiwalletInterface<PossibleProviders, PossibleAccounts> {
  // A map of desired chains to their desired connectors
  enabledChains: {
    [key in string]: MultiwalletConnector<PossibleProviders, PossibleAccounts>;
  };
  targetNetwork: RenNetwork;
  setTargetNetwork: (n: RenNetwork) => void;
  activateConnector: <P, A>(
    chain: string,
    connector: ConnectorInterface<P, A>
  ) => void;
}

const context = createContext<MultiwalletInterface<any, any>>({
  enabledChains: {},
  targetNetwork: RenNetwork.Mainnet,
  setTargetNetwork: () => {},
  activateConnector: () => {
    throw new Error('Multiwallet not ready');
  },
});

export function ConnectorWatcher<P, A>({
  connector,
  chain,
  update,
  targetNetwork,
}: MultiwalletConnector<P, A> & {
  update: (update: MultiwalletConnector<P, A>) => void;
  targetNetwork: RenNetwork;
}) {
  const handleUpdate = useCallback(
    ({ provider, account, renNetwork }) => {
      update({
        connector,
        account,
        chain,
        provider,
        status: renNetwork !== targetNetwork ? 'wrong_network' : 'connected',
      });
    },
    [update, chain, connector, targetNetwork]
  );

  const handleError = useCallback(
    (error) => {
      update({
        connector,
        chain,
        error,
        provider: undefined,
        status: 'disconnected',
      });
      connector.emitter.removeAllListeners();
    },
    [update, chain, connector]
  );

  const handleDeactivate = useCallback(
    (reason: string) => {
      console.log(reason);
      update({
        connector,
        chain,
        provider: undefined,
        status: 'disconnected',
      });
      connector.emitter.removeAllListeners();
    },
    [update, chain, connector]
  );

  useEffect(() => {
    // remove any hanging listeners in case of a re-connect
    connector.emitter.removeAllListeners();

    // re-activating should not be an issue, this saves us from
    // having to keep track of whether the connector is connected
    // in multiple places
    connector
      .activate()
      .then((r) => {
        connector.emitter.addListener(ConnectorEvents.UPDATE, handleUpdate);
        connector.emitter.addListener(ConnectorEvents.ERROR, handleError);
        connector.emitter.addListener(
          ConnectorEvents.DEACTIVATE,
          handleDeactivate
        );
        update({
          connector,
          chain,
          account: r.account,
          provider: r.provider,
          status:
            r.renNetwork !== targetNetwork ? 'wrong_network' : 'connected',
        });
      })
      .catch((e) =>
        update({
          connector,
          chain,
          status: 'disconnected',
          error: e,
        })
      );
    return () => {
      connector.emitter.removeAllListeners();
    };
  }, [
    connector,
    update,
    chain,
    handleDeactivate,
    handleError,
    handleUpdate,
    targetNetwork,
  ]);

  return null;
}

export const MultiwalletProvider = <P, A>({ children }: { children: any }) => {
  const Provider = context.Provider;
  const [targetNetwork, setTargetNetwork] = useState(RenNetwork.Mainnet);
  const [enabledChains, setEnabledChains] = useState<
    MultiwalletInterface<P, A>['enabledChains']
  >({});
  const updateConnector = useCallback(
    (update: MultiwalletConnector<P, A>) => {
      setEnabledChains((c) => ({
        ...c,
        [update.chain]: update,
      }));
    },
    [setEnabledChains]
  );

  const activateConnector = useCallback(
    async (chain, connector) => {
      const oldConnector = enabledChains[chain];
      // Don't re-connect if the same connector is already connecting or connected
      if (
        oldConnector?.connector === connector &&
        oldConnector?.status !== 'disconnected'
      ) {
        return;
      }
      if (oldConnector) {
        if (oldConnector.status !== 'disconnected') {
          await oldConnector.connector.deactivate();
        }
        delete enabledChains[chain];
        setEnabledChains({ ...enabledChains });
      }
      updateConnector({ connector, chain, status: 'connecting' });
    },
    [enabledChains, setEnabledChains, updateConnector]
  );

  return (
    <>
      {Object.entries(enabledChains).map(([chain, x]) => (
        <ConnectorWatcher
          key={chain}
          {...x}
          update={updateConnector}
          targetNetwork={targetNetwork}
        />
      ))}
      <Provider
        value={{
          enabledChains,
          activateConnector,
          targetNetwork,
          setTargetNetwork,
        }}
      >
        {children}
      </Provider>
    </>
  );
};

export const useMultiwallet = <P, A>(): MultiwalletInterface<P, A> => {
  return useContext(context as React.Context<MultiwalletInterface<P, A>>);
};
