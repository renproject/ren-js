import React, { HTMLAttributes, useCallback, useEffect } from 'react';
import {
  Box,
  ButtonBase,
  IconButton,
  makeStyles,
  Modal,
  Paper,
  PaperProps,
  Typography,
} from '@material-ui/core';
import CloseIcon from '@material-ui/icons/Close';
import { ConnectorInterface } from '@renproject/multiwallet-base-connector';
import { useMultiwallet } from './MultiwalletProvider';

export * from './MultiwalletProvider';

export interface ConnectorConfig<P, A> {
  name: string;
  logo: string;
  info?: React.FC<{ acknowledge: () => void; close: () => void }>;
  connector: ConnectorInterface<P, A>;
}

export interface WalletPickerConfig<P, A> {
  chains: { [key in string]: Array<ConnectorConfig<P, A>> };
  debug?: boolean;
}

export interface WalletPickerProps<P, A>
  extends HTMLAttributes<HTMLDivElement> {
  chain: string;
  close: () => void;
  config: WalletPickerConfig<P, A>;
  connecting?: boolean;
  connected?: boolean;
  connectingClasses?: PaperProps['classes'];
  walletClasses?: WalletEntryProps<P, A>['classes'];
  pickerClasses?: ReturnType<typeof useWalletPickerStyles>;
  DefaultInfo?: React.FC<{ acknowledge: () => void; close: () => void }>;
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
  connectingClasses,
  walletClasses,
  pickerClasses,
  DefaultInfo,
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
        (connecting && (
          <Connecting classes={connectingClasses} chain={chain} />
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
    </Paper>
  );
};

export interface WalletPickerModalProps<P, A> {
  options: WalletPickerProps<P, A>;
  close: () => void;
  open?: boolean;
}

export const WalletPickerModal = <P, A>({
  open,
  close,
  options,
}: WalletPickerModalProps<P, A>) => {
  const { enabledChains } = useMultiwallet<P, A>();
  const connecting = enabledChains[options.chain]?.status === 'connecting';
  const connected = enabledChains[options.chain]?.status === 'connected';
  useEffect(() => {
    if (connected) {
      close();
    }
  }, [connected, close]);
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
          connected={connected}
          close={close}
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

  const buildInfo = useCallback(() => {
    if (!Info) return;
    return setInfo(() => (
      <Info
        close={close}
        acknowledge={() => {
          setInfo(undefined);
          activateConnector(chain, connector);
        }}
      />
    ));
  }, [setInfo, activateConnector, close, Info, chain, connector]);

  const defaultClasses = useWalletEntryStyles();
  const combinedClasses = { ...defaultClasses, ...classes };
  return (
    <ButtonBase
      className={combinedClasses.button}
      onClick={() => {
        if (Info) {
          buildInfo();
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
