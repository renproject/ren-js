/* eslint-disable no-console */

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import {
  ConnectorEvents,
  ConnectorInterface,
} from "@renproject/multiwallet-base-connector";
import { RenNetwork } from "@renproject/interfaces";

interface MultiwalletConnector<P, A> {
  connector: ConnectorInterface<P, A>;
  provider?: P;
  account?: A;
  error?: Error;
  chain: string;
  status:
    | "connecting"
    | "connected"
    | "disconnected"
    | "wrong_network"
    | "reconnecting";
  name: string;
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
    connector: ConnectorInterface<P, A>,
    name: string
  ) => void;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const context = createContext<MultiwalletInterface<any, any>>({
  enabledChains: {},
  targetNetwork: RenNetwork.Mainnet,
  setTargetNetwork: () => {
    /* */
  },
  activateConnector: () => {
    throw new Error("Multiwallet not ready");
  },
});

export const ConnectorWatcher = <P, A>({
  connector,
  chain,
  status,
  update,
  targetNetwork,
  name,
}: MultiwalletConnector<P, A> & {
  update: (update: MultiwalletConnector<P, A>) => void;
  targetNetwork: RenNetwork;
}): null => {
  const handleUpdate = useCallback(
    ({ provider, account, renNetwork }) => {
      update({
        name,
        connector,
        account,
        chain,
        provider,
        status: renNetwork !== targetNetwork ? "wrong_network" : "connected",
      });
    },
    [update, chain, connector, targetNetwork]
  );

  const handleError = useCallback(
    (error) => {
      update({
        name,
        connector,
        chain,
        error,
        provider: undefined,
        status: "disconnected",
      });
      connector.emitter.removeAllListeners();
    },
    [update, chain, connector]
  );

  const handleDeactivate = useCallback(
    (reason: string) => {
      console.debug(reason);
      update({
        name,
        connector,
        chain,
        provider: undefined,
        status: "disconnected",
      });
      connector.emitter.removeAllListeners();
    },
    [update, chain, connector]
  );

  const activate = useCallback(() => {
    // re-activating should not be an issue, this saves us from
    // having to keep track of whether the connector is connected
    // in multiple places
    (async () => {
      const r = await connector.activate();
      update({
        name,
        connector,
        chain,
        account: r.account,
        provider: r.provider,
        status: r.renNetwork !== targetNetwork ? "wrong_network" : "connected",
      });
    })().catch((error) => {
      update({
        name,
        connector,
        chain,
        status: "disconnected",
        error,
      });
    });
  }, [connector, update, chain, targetNetwork]);

  // Register listeners
  useEffect(() => {
    // remove any hanging listeners in case of a re-connect
    connector.emitter.removeAllListeners();

    // Immediately add listeners because they may fire before
    // or during activation
    connector.emitter.addListener(ConnectorEvents.UPDATE, handleUpdate);
    connector.emitter.addListener(ConnectorEvents.ERROR, handleError);
    connector.emitter.addListener(ConnectorEvents.DEACTIVATE, handleDeactivate);

    return () => {
      connector.emitter.removeAllListeners();
    };
  }, [connector, handleDeactivate, handleError, handleUpdate]);

  // Always re-activate if targetNetwork has changed
  useEffect(() => {
    activate();
  }, [activate, targetNetwork]);

  // Re-activate if reconnecting
  useEffect(() => {
    if (status === "reconnecting") {
      update({
        name,
        connector,
        chain,
        status: "connecting",
      });
      activate();
    }
  }, [activate, status]);

  return null;
};

export const MultiwalletProvider = <P, A>({
  children,
}: {
  children?: React.ReactNode;
}): JSX.Element => {
  const Provider = context.Provider;
  const [targetNetwork, setTargetNetwork] = useState(RenNetwork.Mainnet);
  const [enabledChains, setEnabledChains] = useState<
    MultiwalletInterface<P, A>["enabledChains"]
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
    async (chain: string, connector, name: string) => {
      // catch insecure connector modification
      if (enabledChains.hasOwnProperty(chain)) {
        // eslint-disable-next-line security/detect-object-injection
        const oldConnector = enabledChains[chain];
        // Don't re-connect if the same connector is already connecting or connected
        if (
          oldConnector.connector === connector &&
          !["disconnected", "wrong_network"].includes(oldConnector?.status)
        ) {
          return;
        }

        // Deactivate the current connector
        if (oldConnector.status !== "disconnected") {
          await oldConnector.connector.deactivate();
        }
        // eslint-disable-next-line security/detect-object-injection
        delete enabledChains[chain];
        setEnabledChains({ ...enabledChains });
        updateConnector({ connector, chain, name, status: "reconnecting" });
      } else {
        updateConnector({ connector, chain, name, status: "connecting" });
      }
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
