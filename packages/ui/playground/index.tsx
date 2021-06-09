import * as React from "react";
import * as ReactDOM from "react-dom";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
    Button,
    Container,
    MenuItem,
    Paper,
    Select,
    Typography,
    Input,
} from "@material-ui/core";

import RenJS from "../../lib/ren/src";
import {
    BasicMint,
    BasicBurn,
    DefaultDeposit,
    DepositProps,
} from "../../ui/ren-react";
import { Ethereum, EthereumConfig } from "../../lib/chains/chains-ethereum/src";
import { Solana } from "../../lib/chains/chains-solana/src";
import { Bitcoin } from "../../lib/chains/chains-bitcoin";
import { RenNetwork } from "@renproject/interfaces";
import {
    WalletPickerModal,
    MultiwalletProvider,
    useMultiwallet,
} from "@renproject/multiwallet-ui";
import { RenVMProvider } from "@renproject/rpc/build/main/v2/renVMProvider";
import { multiwalletOptions } from "./multiwallet";
import { lockChainMap, mintChainMap } from "./chainmaps";
import { inspect } from "@xstate/inspect";
import { buildMintContextWithMap } from "@renproject/ren-tx";
inspect({
    iframe: false, // open in new window
});

const localProvider = new RenVMProvider({
    name: "testnet-v0.3",
    lightnode: "http://localhost:5000",
    isTestnet: true,
});

const INFURA_PROJECT_ID = process.env.REACT_APP_INFURA_PROJECT_ID;

const ethLocalnetConfig: EthereumConfig = {
    name: "testnet",
    chain: "localnet",
    isTestnet: true,
    chainLabel: "Localnet",
    networkID: 1337,
    infura: "http://localhost:8545",
    etherscan: "https://etherscan.io",
    addresses: {
        GatewayRegistry: "0x0Bb909b7c3817F8fB7188e8fbaA2763028956E30",
        BasicAdapter: "0x809fd89454819d7f71B01a2f3dAC377E6a87FBCE",
    },
};

const BasicBurnApp = ({ account, provider, destinationAddress, amount }) => {
    const parameters = useMemo(
        () => ({
            sdk: new RenJS(RenNetwork.TestnetVDot3),
            burnParams: {
                sourceAsset: "BTC",
                network: RenNetwork.Testnet,
                targetAmount: amount,
                destinationAddress,
            },
            from: new Solana(provider, RenNetwork.Testnet, {
                logger: console,
            }).Account({
                amount,
            }),
            to: Bitcoin().Address(destinationAddress),
        }),
        [provider, account, amount, destinationAddress],
    );
    return (
        <Typography component="div">
            <BasicBurn parameters={parameters} />
        </Typography>
    );
};

const CustomDeposit = (props: DepositProps) => (
    <DefaultDeposit
        currency={props.currency}
        session={props.session}
        depositId={props.depositId}
    />
);

const BasicMintApp = ({ sdk, chain, account, providers, asset }) => {
    const solanaMintChain = useMemo(() => {
        console.log(providers);
        return (
            chain === "solana" &&
            providers[chain] &&
            new Solana(providers[chain].connector, RenNetwork.TestnetVDot3, {
                logger: console,
            })
        );
    }, [providers, chain]);

    const [tokenAccountExists, setTokenAccountExists] = useState(false);

    // ensure that the solana mint destination exists
    useEffect(() => {
        if (!tokenAccountExists) {
            solanaMintChain &&
                solanaMintChain.createAssociatedTokenAccount(asset).then(() => {
                    setTokenAccountExists(true);
                });
        }
    }, [solanaMintChain, tokenAccountExists, setTokenAccountExists, asset]);

    const parameters = useMemo(
        () => ({
            sdk,
            mintParams: {
                network: RenNetwork.TestnetVDot3,
                sourceAsset: asset,
                destinationAddress: account,
            },
            sourceChain: source[asset],
            userAddress: account,
            destinationChain: chain,
            toMap: mintChainMap(providers),
            fromMap: lockChainMap,
            customParams: {},
        }),
        [providers, account],
    );

    return (
        <Paper style={{ margin: "1em", padding: "1em" }}>
            <Typography component={"div"}>
                {tokenAccountExists ? (
                    <BasicMint
                        parameters={parameters}
                        Deposit={CustomDeposit}
                    />
                ) : (
                    <p>Please create a token account for {asset}</p>
                )}
            </Typography>
        </Paper>
    );
};

const ConnectToChain = ({ setOpen, setChain }) => {
    return (
        <Paper style={{ margin: "1em" }}>
            {Object.keys(multiwalletOptions.chains).map((chain) => (
                <Button
                    variant="contained"
                    style={{ margin: "1em", marginRight: "0" }}
                    color="primary"
                    key={chain}
                    onClick={() => {
                        setChain(chain);
                        setOpen(true);
                    }}
                >
                    Connect To {chain}
                </Button>
            ))}
        </Paper>
    );
};

const source = { BTC: "bitcoin", ZEC: "zcash", BCH: "bitcoinCash" };
const supportedAssets = ["BTC", "ZEC", "BCH"];

const App = (): JSX.Element => {
    const [open, setOpen] = useState(false);
    const [chain, setChain] = useState<
        keyof typeof multiwalletOptions["chains"]
    >("solana");
    const [asset, setAsset] = useState("BTC");
    const wallets = useMultiwallet();
    const [address, setAddress] = useState<string>("");
    const updateAddress = useCallback(
        (e: React.ChangeEvent<any>) => setAddress(e.target.value),
        [setAddress],
    );

    const [amount, setAmount] = useState<number>(20000);
    const updateAmount = useCallback(
        (e: React.ChangeEvent<any>) =>
            setAmount(parseFloat(e.target.value) * 1e8),
        [setAmount],
    );

    const selectAsset = useCallback(
        (e: React.ChangeEvent<any>) => setAsset(e.target.value),
        [setAsset],
    );
    const setClosed = useCallback(() => setOpen(false), [setOpen]);

    const sdk = useMemo(() => new RenJS(RenNetwork.TestnetVDot3), []);

    const [balance, setBalance] = useState<string>();
    useEffect(() => {
        if (Object.keys(wallets.enabledChains).includes("ethereum")) {
            const provider = wallets.enabledChains["ethereum"].provider as any;
            const account = wallets.enabledChains["ethereum"].account as string;

            if (!provider || !account) return;
            Ethereum(provider, ethLocalnetConfig)
                .getBalance(asset, account)
                .then((v) => setBalance(v.minus(1000).toString()));
        }
    }, [wallets, setBalance]);

    return (
        <Container
            style={{ display: "flex", flexDirection: "column", gap: "1em" }}
        >
            <WalletPickerModal
                open={open}
                options={{
                    chain,
                    onClose: setClosed,
                    config: multiwalletOptions,
                    targetNetwork: RenNetwork.TestnetVDot3,
                }}
            />
            <ConnectToChain
                enabledChains={wallets.enabledChains}
                setOpen={setOpen}
                setChain={setChain}
            />
            <Paper
                style={{
                    padding: "1em",
                    display: "flex",
                    alignItems: "center",
                    gap: "1em",
                }}
            >
                <Typography>Select Asset:</Typography>
                <Select
                    labelId="demo-simple-select-label"
                    id="demo-simple-select"
                    value={asset}
                    onChange={selectAsset}
                >
                    {supportedAssets.map((asset) => (
                        <MenuItem key={asset} value={asset}>
                            {asset}
                        </MenuItem>
                    ))}
                </Select>
            </Paper>
            {Object.keys(wallets.enabledChains)
                .filter(
                    (chain) =>
                        wallets.enabledChains[chain].provider &&
                        wallets.enabledChains[chain].account,
                )
                .map((chain) => [
                    chain,
                    chain
                        .split("")
                        .map((x, i) => (!i ? x.toUpperCase() : x))
                        .join(""),
                ])
                .map(([chain, fChain]) => (
                    <Paper key={chain} style={{ padding: "1em" }}>
                        <Typography variant="h4">Mint To {fChain}</Typography>{" "}
                        <Typography>
                            Connected to {wallets.enabledChains[chain].account}
                        </Typography>
                        <BasicMintApp
                            asset={asset}
                            sdk={sdk}
                            chain={chain}
                            providers={wallets.enabledChains}
                            account={wallets.enabledChains[chain].account}
                        />
                        <div>
                            <Typography variant="h4">
                                Burn from {fChain}
                            </Typography>
                            <Typography>
                                {asset} Balance: {balance}
                            </Typography>
                            <Input
                                placeholder="recipient address"
                                defaultValue="miMi2VET41YV1j6SDNTeZoPBbmH8B4nEx6"
                                onChange={updateAddress}
                                style={{ width: "100%" }}
                            />
                            <Input
                                placeholder="amount"
                                value={amount / 1e8}
                                type="number"
                                onChange={updateAmount}
                                style={{ width: "100%" }}
                            />
                            {address.length > 0 && (
                                <BasicBurnApp
                                    provider={
                                        wallets.enabledChains[chain].provider
                                    }
                                    account={
                                        wallets.enabledChains[chain].account
                                    }
                                    destinationAddress={address}
                                    amount={amount}
                                />
                            )}
                        </div>
                    </Paper>
                ))}
        </Container>
    );
};

ReactDOM.render(
    <MultiwalletProvider>
        <App />
    </MultiwalletProvider>,
    document.getElementById("root"),
);
