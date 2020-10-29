import {
    Box,
    ButtonBase,
    IconButton,
    Modal,
    Paper,
    PaperProps,
    Typography,
} from "@material-ui/core";
import { makeStyles } from "@material-ui/core/styles";
import CloseIcon from "@material-ui/icons/Close";
import { RenNetwork } from "@renproject/interfaces";
import { ConnectorInterface } from "@renproject/multiwallet-base-connector";
import React, { HTMLAttributes, useCallback, useEffect } from "react";

import { useMultiwallet } from "./MultiwalletProvider";

export * from './MultiwalletProvider';

export interface ConnectorConfig<P, A> {
  /**
   * Name of the wallet
   */
  name: string;
  /**
   * URL for logo to be shown (might change in future to a component)
   */
  logo: string;
  /**
   * The Multiwallet Connector to be used for this wallet
   */
  connector: ConnectorInterface<P, A>;
  /**
     A component to be shown before a wallet is activated, for extra context / warnings
  */
  info?: React.FC<{ acknowledge: () => void; onClose: () => void }>;
}

export interface WalletPickerConfig<P, A> {
  chains: { [key in string]: Array<ConnectorConfig<P, A>> };
  debug?: boolean;
}

export interface WalletPickerProps<P, A>
  extends HTMLAttributes<HTMLDivElement> {
  /**
   * Which chain to show wallets for
   */
  chain: string;
  /**
     Function used to close/cancel the connection request
   */
  onClose: () => void;
  /**
   * Configuration for connectors across all chains
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
  targetNetwork: RenNetwork | string;
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
  DefaultInfo?: React.FC<{ acknowledge: () => void; onClose: () => void }>;
  /**
     An optional replacement to show when a wallet is connecting
   */
  ConnectingInfo?: React.FC<{ chain: string; onClose: () => void }>;
  /**
     An optional replacement to show when a wallet is connected to the wong network
   */
  WrongNetworkInfo?: React.FC<{
    chain: string;
    targetNetwork: string;
    onClose: () => void;
  }>;

  /**
     An optional replacement for the button shown for each wallet option
   */
  WalletEntryButton?: React.FC<{
    chain: string;
    onClick: () => void;
    name: string;
    logo: string;
  }>;
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
  headerTitle: {},
  headerCloseIcon: {},
  body: {
    textTransform: 'capitalize',
  },
  chainTitle: {
    textTransform: 'capitalize',
  },
});

export const WalletPickerHeader = ({
  title,
  classes,
  onClose,
}: {
  title: string;
  classes: ReturnType<typeof useWalletPickerStyles>;
  onClose: WalletPickerProps<any, any>['onClose'];
}) => (
  <Box pl={2} className={classes.header} flexDirection="row">
    <Typography className={classes.headerTitle}>{title}</Typography>
    <IconButton
      className={classes.headerCloseIcon}
      onClick={onClose}
      aria-label="close"
    >
      <CloseIcon />
    </IconButton>
  </Box>
);

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
  onClose,
  connecting,
  wrongNetwork,
  targetNetwork,
  connectingClasses,
  walletClasses,
  pickerClasses,
  DefaultInfo,
  ConnectingInfo,
  WrongNetworkInfo,
  WalletEntryButton,
  children,
}: WalletPickerProps<P, A>) => {
  const defaultClasses = useWalletPickerStyles();
  const classes = { ...defaultClasses, ...pickerClasses };

  const connectors = config.chains[chain];

  // Allow for an information screen to be set before the wallet selection is showed
  const [Info, setInfo] = React.useState(
    DefaultInfo
      ? () => (
          <DefaultInfo
            onClose={onClose}
            acknowledge={() => setInfo(undefined)}
          />
        )
      : undefined
  );

  return (
    <Paper className={classes.root}>
      {Info ||
        (connecting &&
          (ConnectingInfo ? (
            <ConnectingInfo chain={chain} onClose={onClose} />
          ) : (
            <>
              <WalletPickerHeader
                classes={classes}
                onClose={onClose}
                title="Connecting"
              />
              <Connecting classes={connectingClasses} chain={chain} />
            </>
          ))) ||
        (wrongNetwork &&
          (WrongNetworkInfo ? (
            <WrongNetworkInfo
              chain={chain}
              targetNetwork={targetNetwork}
              onClose={onClose}
            />
          ) : (
            <>
              <WalletPickerHeader
                classes={classes}
                onClose={onClose}
                title="Wrong Network"
              />
              <WrongNetwork
                classes={connectingClasses}
                chain={chain}
                targetNetwork={targetNetwork}
              />
            </>
          ))) || (
          <>
            <WalletPickerHeader
              classes={classes}
              onClose={onClose}
              title="Connect a wallet"
            />
            <Box p={2} className={classes.body}>
              <Typography className={classes.chainTitle}>{chain}</Typography>
              {connectors.map((x) => (
                <WalletEntry
                  key={x.name}
                  {...x}
                  classes={walletClasses}
                  onClose={onClose}
                  chain={chain}
                  setInfo={setInfo}
                  WalletEntryButton={WalletEntryButton}
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
   * Whether to show the modal
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
      options.onClose();
    }
  }, [connected, options]);

  useEffect(() => {
    if (options.targetNetwork !== targetNetwork) {
      switch (options.targetNetwork) {
        case 'testnet':
          setTargetNetwork(RenNetwork.Testnet);
          break;
        case 'mainnet':
          setTargetNetwork(RenNetwork.Mainnet);
      }
    }
  }, [options.targetNetwork, targetNetwork, setTargetNetwork]);

  const cancel = useCallback(() => {
    if (connecting || wrongNetwork) {
      enabledChains[options.chain]?.connector.deactivate();
    }
    options.onClose();
  }, [connecting, wrongNetwork, enabledChains, options]);

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
          onClose={cancel}
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
  onClose: () => void;
  setInfo: (i: any) => void;
  WalletEntryButton?: WalletPickerProps<P, A>['WalletEntryButton'];
}

const WalletEntry = <P, A>({
  name,
  chain,
  logo,
  connector,
  info: Info,
  classes,
  onClose,
  setInfo,
  WalletEntryButton,
}: WalletEntryProps<P, A> & {}) => {
  const { activateConnector } = useMultiwallet<P, A>();

  const buildInfo = useCallback(
    (Info) => {
      return setInfo(() => (
        <Info
          onClose={onClose}
          acknowledge={() => {
            setInfo(undefined);
            activateConnector(chain, connector);
          }}
        />
      ));
    },
    [setInfo, activateConnector, onClose, chain, connector]
  );

  const defaultClasses = useWalletEntryStyles();
  const combinedClasses = { ...defaultClasses, ...classes };
  const onClick = useCallback(() => {
    if (Info) {
      buildInfo(Info);
    } else {
      activateConnector(chain, connector);
    }
  }, [activateConnector, buildInfo, Info, chain, connector]);

  return WalletEntryButton ? (
    <WalletEntryButton
      chain={chain}
      onClick={onClick}
      name={name}
      logo={logo}
    />
  ) : (
    <ButtonBase className={combinedClasses.button} onClick={onClick}>
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
