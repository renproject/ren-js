import "react-app-polyfill/ie11";

import * as React from "react";
import * as ReactDOM from "react-dom";

import { Box, Button, Container, Paper, Typography } from "@material-ui/core";

import { BinanceSmartChainInjectedConnector } from "../../../lib/multiwallet/multiwallet-binancesmartchain-injected-connector/src/index";
import { EthereumInjectedConnector } from "../../../lib/multiwallet/multiwallet-ethereum-injected-connector/src/index";
import { EthereumMEWConnectConnector } from "../../../lib/multiwallet/multiwallet-ethereum-mewconnect-connector/src/index";
import { EthereumWalletConnectConnector } from "../../../lib/multiwallet/multiwallet-ethereum-walletconnect-connector/src/index";
import { WalletPickerConfig, WalletPickerModal } from "../src";
import {
    MultiwalletProvider,
    useMultiwallet,
} from "../src/MultiwalletProvider";

const options: WalletPickerConfig<unknown, string> = {
  chains: {
    ethereum: [
      {
        name: "Metamask",
        logo: "https://avatars1.githubusercontent.com/u/11744586?s=60&v=4",
        connector: new EthereumInjectedConnector({ debug: true }),
      },
      {
        name: "WalletConnect",
        logo: "https://avatars0.githubusercontent.com/u/37784886?s=60&v=4",
        connector: new EthereumWalletConnectConnector({
          rpc: {
            1: `https://mainnet.infura.io/v3/${process.env.REACT_APP_INFURA_KEY}`,
            42: `https://kovan.infura.io/v3/${process.env.REACT_APP_INFURA_KEY}`,
          },
          qrcode: true,
          debug: true,
        }),
      },
      {
        name: "MEW",
        logo: "https://avatars0.githubusercontent.com/u/24321658?s=60&v=4",
        connector: new EthereumMEWConnectConnector({
          rpc: {
            1: `https://mainnet.infura.io/v3/${process.env.REACT_APP_INFURA_KEY}`,
            42: `wss://kovan.infura.io/ws/v3/${process.env.REACT_APP_INFURA_KEY}`,
          },
          chainId: 42,
          debug: true,
        }),
      },
    ],
    bsc: [
      {
        name: "BinanceSmartWallet",
        logo: "https://avatars2.githubusercontent.com/u/45615063?s=60&v=4",
        connector: new BinanceSmartChainInjectedConnector({ debug: true }),
      },
    ],
  },
};

const WalletDemo: React.FC<{ network: string }> = () => {
  const context = useMultiwallet<unknown, unknown>();

  return (
    <>
      {Object.entries(context.enabledChains).map(([chain, connector]) => (
        <Paper>
          <Box p={2}>
            <Typography key={chain}>
              {chain}: Status {connector.status} to {connector.account}
            </Typography>
          </Box>
        </Paper>
      ))}
    </>
  );
};

const App = () => {
  const [open, setOpen] = React.useState(false);
  const [chain, setChain] = React.useState("");
  const setClosed = React.useMemo(() => () => setOpen(false), [setOpen]);
  const [network, setNetwork] = React.useState("testnet");

  return (
    <Box bgcolor="#fafafa" height="100vh" display="flex" alignItems="center">
      <MultiwalletProvider>
        <Container>
          <Box
            height="70vh"
            display="flex"
            flexDirection="column"
            justifyContent="space-around"
            borderRadius={2}
            bgcolor="primary"
          >
            <select
              value={network}
              onChange={(e) => setNetwork(e.target.value)}
            >
              <option value="testnet">Testnet</option>
              <option value="mainnet">Mainnet</option>
            </select>
            <WalletDemo network={network} />
            <Box display="flex" justifyContent="center">
              <Button
                color="primary"
                variant="outlined"
                onClick={() => {
                  setChain("ethereum");
                  setOpen(true);
                }}
              >
                Request Ethereum
              </Button>
              <Button
                color="primary"
                variant="outlined"
                onClick={() => {
                  setChain("bsc");
                  setOpen(true);
                }}
              >
                Request BSC
              </Button>
            </Box>
          </Box>
        </Container>
        <WalletPickerModal
          open={open}
          options={{
            chain,
            onClose: setClosed,
            config: options,
            targetNetwork: network,
          }}
        />
      </MultiwalletProvider>
    </Box>
  );
};

ReactDOM.render(<App />, document.getElementById("root"));
