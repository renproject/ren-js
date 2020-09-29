import React, { HTMLAttributes } from 'react';
import {
  Box,
  ButtonBase,
  Container,
  IconButton,
  makeStyles,
  Modal,
  Paper,
  Typography,
} from '@material-ui/core';
import CloseIcon from '@material-ui/icons/Close';
import { ConnectorInterface } from '@renproject/multiwallet-base-connector';
import { useMultiwallet } from './MultiwalletProvider';

export * from './MultiwalletProvider';

export interface ConnectorConfig<P, A> {
  name: string;
  logo: string;
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
}

const useWalletPickerStyles = makeStyles({
  root: {
    maxWidth: 400,
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
 * A WalletPicker component, intended to be launched in a modal
 */
export const WalletPicker = <P, A>({
  chain,
  config,
  close,
}: WalletPickerProps<P, A>) => {
  const classes = useWalletPickerStyles();
  const connectors = config.chains[chain];
  return (
    <Paper className={classes.root}>
      <Box pl={2} className={classes.header} flex flexDirection="row">
        <Typography>Connect a wallet</Typography>
        <IconButton onClick={close} aria-label="close">
          <CloseIcon />
        </IconButton>
      </Box>
      <Box p={2} className={classes.body}>
        <Typography>{chain}</Typography>
        {connectors.map((x) => (
          <Wallet key={x.name} {...x} chain={chain} close={close} />
        ))}
      </Box>
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
}: WalletPickerModalProps<P, A>) => (
  <Modal open={open || false}>
    <Container style={{ height: '100vh' }}>
      <WalletPicker {...options} close={close} />
    </Container>
  </Modal>
);

const useWalletStyles = makeStyles({
  fill: {
    width: '100%',
  },
  grow: {
    flexGrow: 1,
  },
  body: {
    display: 'flex',
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    textTransform: 'capitalize',
  },
});
const Wallet = <P, A>({
  name,
  chain,
  logo,
  connector,
  close,
}: ConnectorConfig<P, A> & { chain: string; close: () => void }) => {
  const { activateConnector } = useMultiwallet<P, A>();
  const classes = useWalletStyles();
  return (
    <Box pt={1} display="flex">
      <ButtonBase
        className={classes.grow}
        onClick={() => {
          close();
          activateConnector(chain, connector);
        }}
      >
        <Paper className={classes.grow}>
          <Box className={classes.body} p={2}>
            <Typography>{name}</Typography>{' '}
            <img alt={`${name} logo`} src={logo} />
          </Box>
        </Paper>
      </ButtonBase>
    </Box>
  );
};
