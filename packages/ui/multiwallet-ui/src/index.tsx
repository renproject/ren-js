import React, { HTMLAttributes, useCallback, useEffect } from 'react';
import {
  Box,
  ButtonBase,
  IconButton,
  Modal,
  Paper,
  PaperProps,
  Typography,
} from '@material-ui/core';
import { makeStyles } from '@material-ui/core/styles';
import CloseIcon from '@material-ui/icons/Close';
import { ConnectorInterface } from '@renproject/multiwallet-base-connector';
import { useMultiwallet } from './MultiwalletProvider';
import { RenNetwork } from '@renproject/interfaces';

export * from './MultiwalletProvider';

export interface ConnectorConfig<P, A> {
  /**
     Name of the wallet
   */
  name: string;
  /**
     URL for logo to be shown (might change in future to a component)
   */
  logo: string;
  /**
     The Multiwallet Connector to be used for this wallet
   */
  connector: ConnectorInterface<P, A>;
  /**
     A component to be shown before a wallet is activated, for extra context / warnings
  */
  info?: React.FC<{ acknowledge: () => void; close: () => void }>;
}

export interface WalletPickerConfig<P, A> {
  chains: { [key in string]: Array<ConnectorConfig<P, A>> };
  debug?: boolean;
}

export interface WalletPickerProps<P, A>
  extends HTMLAttributes<HTMLDivElement> {
  /**
     Which chain to show wallets for
   */
  chain: string;
  /**
     Function used to close/cancel the connection request
     */
  close: () => void;
  /**
     Configuration for connectors across all chains
   */
  config: WalletPickerConfig<P, A>;
  /**
     Whether a wallet is in the process of connecting
     */
  connecting?: boolean;
  /**
       Whether a wallet is connected to the wrong chain
     */
  wrongNetwork?: boolean;
  /**
       Network the wallet should connect to
     */
  targetNetwork: RenNetwork;
  /**
     MaterialUI class overrides for the component shown when connecting
     */
  connectingClasses?: PaperProps['classes'];
  /**
       MaterialUI class overrides for the wallet selection components
     */
  walletClasses?: WalletEntryProps<P, A>['classes'];
  /**
       MaterialUI class overrides for the picker container
     */
  pickerClasses?: ReturnType<typeof useWalletPickerStyles>;
  /**
       An optional component to show before wallets are presented
     */
  DefaultInfo?: React.FC<{ acknowledge: () => void; close: () => void }>;
  /**
       An optional replacement to show when a wallet is connecting
     */
  ConnectingInfo?: React.FC<{ chain: string }>;
}

const useWalletPickerStyles = makeStyles({
  root: {
    maxWidth: 400,
    minWidth: 380,
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  body: {
    textTransform: 'capitalize',
  },
});

/**
 * A WalletPicker component, intended to be launched in a modal.
 * Will present the user with a list of wallets for the selected chain
 * If DefaultInfo is provided, if will be displayed before the list is shown
 * If a selected wallet has an info component, that will be displayed
 * after the wallet is selected, and will only proceed to enable the wallet
 * after the user has acknowledged the prompt.
 * The component will show a loading state while the wallet is being enabled
 */
export const WalletPicker = <P, A>({
  chain,
  config,
  close,
  connecting,
  wrongNetwork,
  targetNetwork,
  connectingClasses,
  walletClasses,
  pickerClasses,
  DefaultInfo,
  ConnectingInfo,
  children,
}: WalletPickerProps<P, A>) => {
  const defaultClasses = useWalletPickerStyles();
  const classes = { ...defaultClasses, ...pickerClasses };

  const connectors = config.chains[chain];

  // Allow for an information screen to be set before the wallet selection is showed
  const [Info, setInfo] = React.useState(
    DefaultInfo
      ? () => (
          <DefaultInfo close={close} acknowledge={() => setInfo(undefined)} />
        )
      : undefined
  );

  return (
    <Paper className={classes.root}>
      {Info ||
        (connecting &&
          ((ConnectingInfo && <ConnectingInfo chain={chain} />) || (
            <Connecting classes={connectingClasses} chain={chain} />
          ))) ||
        (wrongNetwork && (
          <WrongNetwork
            classes={connectingClasses}
            chain={chain}
            targetNetwork={targetNetwork}
          />
        )) || (
          <>
            <Box pl={2} className={classes.header} flexDirection="row">
              <Typography>Connect a wallet</Typography>
              <IconButton onClick={close} aria-label="close">
                <CloseIcon />
              </IconButton>
            </Box>
            <Box p={2} className={classes.body}>
              <Typography>{chain}</Typography>
              {connectors.map((x) => (
                <WalletEntry
                  key={x.name}
                  {...x}
                  classes={walletClasses}
                  close={close}
                  chain={chain}
                  setInfo={setInfo}
                />
              ))}
            </Box>
          </>
        )}
      {children}
    </Paper>
  );
};

export interface WalletPickerModalProps<P, A> {
  /**
   See the props for the WalletPicker component
   */
  options: WalletPickerProps<P, A>;
  /**
     Whether to show the modal
   */
  open?: boolean;
}

export const WalletPickerModal = <P, A>({
  open,
  options,
}: WalletPickerModalProps<P, A>) => {
  const { enabledChains, targetNetwork, setTargetNetwork } = useMultiwallet<
    P,
    A
  >();
  const connecting = enabledChains[options.chain]?.status === 'connecting';
  const connected = enabledChains[options.chain]?.status === 'connected';
  const wrongNetwork = enabledChains[options.chain]?.status === 'wrong_network';
  useEffect(() => {
    if (connected) {
      options.close();
    }
  }, [connected, options]);

  useEffect(() => {
    if (options.targetNetwork !== targetNetwork) {
      setTargetNetwork(options.targetNetwork);
    }
  }, [options.targetNetwork, targetNetwork, setTargetNetwork]);

  return (
    <Modal open={open || false}>
      <Box
        height="100vh"
        width="100%"
        display="flex"
        alignItems="center"
        justifyContent="center"
      >
        <WalletPicker
          {...options}
          connecting={connecting}
          wrongNetwork={wrongNetwork}
        />
      </Box>
    </Modal>
  );
};

const useWalletEntryStyles = makeStyles((t) => ({
  button: {
    width: '100%',
    display: 'flex',
    padding: t.spacing(2),
  },
  body: {
    padding: t.spacing(2),
    flexGrow: 1,
    display: 'flex',
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    textTransform: 'capitalize',
  },
}));

interface WalletEntryProps<P, A> extends ConnectorConfig<P, A> {
  chain: string;
  classes?: ReturnType<typeof useWalletEntryStyles>;
  close: () => void;
  setInfo: (i: any) => void;
}

const WalletEntry = <P, A>({
  name,
  chain,
  logo,
  connector,
  info: Info,
  classes,
  close,
  setInfo,
}: WalletEntryProps<P, A> & {}) => {
  const { activateConnector } = useMultiwallet<P, A>();

  const buildInfo = useCallback(
    (Info) => {
      return setInfo(() => (
        <Info
          close={close}
          acknowledge={() => {
            setInfo(undefined);
            activateConnector(chain, connector);
          }}
        />
      ));
    },
    [setInfo, activateConnector, close, chain, connector]
  );

  const defaultClasses = useWalletEntryStyles();
  const combinedClasses = { ...defaultClasses, ...classes };
  return (
    <ButtonBase
      className={combinedClasses.button}
      onClick={() => {
        if (Info) {
          buildInfo(Info);
        } else {
          activateConnector(chain, connector);
        }
      }}
    >
      <Paper className={combinedClasses.body}>
        <Typography>{name}</Typography> <img alt={`${name} logo`} src={logo} />
      </Paper>
    </ButtonBase>
  );
};

const useConnectingStyles = makeStyles((t) => ({
  root: {
    display: 'flex',
    padding: t.spacing(2),
    justifyContent: 'center',
  },
}));

// Element to show when a selected chain is connecting
const Connecting: React.FC<{
  chain: string;
  classes?: PaperProps['classes'];
}> = ({ chain, classes }) => {
  const defaultClasses = useConnectingStyles();
  return (
    <Paper classes={classes || defaultClasses}>
      <Typography>Connecting to {chain}</Typography>
    </Paper>
  );
};

// Element to show when a selected chain is connectted to the wrong network
const WrongNetwork: React.FC<{
  chain: string;
  targetNetwork: string;
  classes?: PaperProps['classes'];
}> = ({ chain, classes, targetNetwork }) => {
  const defaultClasses = useConnectingStyles();
  return (
    <Paper classes={classes || defaultClasses}>
      <Typography>
        Connected to {chain} on the wrong network, please connect to{' '}
        {targetNetwork}
      </Typography>
    </Paper>
  );
};
