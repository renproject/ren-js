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
import { chainStringToRenChain, lockChainMap, mintChainMap } from "./chainmaps";
import { inspect } from "@xstate/inspect";

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

const source = { BTC: "bitcoin", ZEC: "zcash", BCH: "bitcoinCash" };
const supportedAssets = ["BTC", "ZEC", "BCH"];
const renNetworks = [...Object.values(RenNetwork)];

const BasicBurnApp = ({
    network,
    account,
    provider,
    destinationAddress,
    amount,
}) => {
    const parameters = useMemo(
        () => ({
            sdk: new RenJS(network),
            burnParams: {
                sourceAsset: "BTC",
                network,
                targetAmount: amount,
                destinationAddress,
            },
            from: new Solana(provider, network, {
                logger: console,
            }).Account({
                amount,
            }),
            to: Bitcoin(network).Address(destinationAddress),
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

const BasicMintApp = ({ network, chain, account, providers, asset }) => {
    const [tokenAccountExists, setTokenAccountExists] = useState(false);
    const [tokenAccountError, setTokenAccountError] = useState<string>();

    const solanaMintChain = useMemo(() => {
        if (chain !== "solana") {
            setTokenAccountExists(true);
            return;
        }
        return (
            providers[chain] &&
            new Solana(providers[chain].connector, network, {
                logger: console,
            })
        );
    }, [providers, chain]);

    // ensure that the solana mint destination exists
    useEffect(() => {
        if (!tokenAccountExists) {
            solanaMintChain &&
                solanaMintChain
                    .createAssociatedTokenAccount(asset)
                    .then(() => {
                        setTokenAccountExists(true);
                    })
                    .catch((e) =>
                        setTokenAccountError("Failed to create token account"),
                    );
        }
    }, [solanaMintChain, tokenAccountExists, setTokenAccountExists, asset]);

    const parameters = useMemo(
        () => ({
            sdk: new RenJS(network, { loadCompletedDeposits: true }),
            mintParams: {
                network,
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
                ) : tokenAccountError ? (
                    <p>{tokenAccountError}</p>
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
            {Object.keys(multiwalletOptions(RenNetwork.Mainnet).chains).map(
                (chain) => (
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
                ),
            )}
        </Paper>
    );
};

const DropdownSelect = ({ name, value, setValue, values }) => {
    const selectValue = useCallback(
        (e: React.ChangeEvent<any>) => setValue(e.target.value),
        [setValue],
    );
    return (
        <Paper
            style={{
                padding: "1em",
                display: "flex",
                alignItems: "center",
                gap: "1em",
            }}
        >
            <Typography>Select {name}:</Typography>
            <Select value={value} onChange={selectValue}>
                {values.map((v) => (
                    <MenuItem key={v} value={v}>
                        {v}
                    </MenuItem>
                ))}
            </Select>
        </Paper>
    );
};

const App = (): JSX.Element => {
    const [chain, setChain] = useState<
        keyof ReturnType<typeof multiwalletOptions>["chains"]
    >("solana");
    const [asset, setAsset] = useState("BTC");
    const [network, setNetwork] = useState(renNetworks[1]);

    const wallets = useMultiwallet();
    const [open, setOpen] = useState(false);
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

    const setClosed = useCallback(() => setOpen(false), [setOpen]);

    const [balances, setBalances] = useState<{ [chain: string]: string }>({});
    useEffect(() => {
        Object.entries(wallets.enabledChains).map(([chain, connector]) => {
            const provider = connector.provider as any;
            const account = connector.account as string;

            if (!provider || !account) return;
            new chainStringToRenChain[chain](provider, network)
                .getBalance(asset, account)
                .then((value) =>
                    setBalances((balances) => ({
                        ...balances,
                        [chain]: value.toString(),
                    })),
                );
        });
    }, [wallets, setBalances]);

    return (
        <Container
            style={{ display: "flex", flexDirection: "column", gap: "1em" }}
        >
            <WalletPickerModal
                open={open}
                options={{
                    chain,
                    onClose: setClosed,
                    config: multiwalletOptions(network),
                    targetNetwork: network,
                }}
            />
            <ConnectToChain
                enabledChains={wallets.enabledChains}
                setOpen={setOpen}
                setChain={setChain}
            />
            <Container
                style={{ display: "flex", flexDirection: "row", gap: "1em" }}
            >
                <DropdownSelect
                    name={"Asset"}
                    value={asset}
                    setValue={setAsset}
                    values={supportedAssets}
                />
                <DropdownSelect
                    name={"Network"}
                    value={network}
                    setValue={setNetwork}
                    values={renNetworks}
                />
            </Container>

            {Object.keys(wallets.enabledChains)
                .filter(
                    (chain) =>
                        wallets.enabledChains[chain].provider &&
                        wallets.enabledChains[chain].account,
                )
                .map((chain) => (
                    <Paper key={chain} style={{ padding: "1em" }}>
                        <Typography
                            variant="h4"
                            style={{ textTransform: "capitalize" }}
                        >
                            Mint To {chain}
                        </Typography>{" "}
                        <Typography>
                            Connected to {wallets.enabledChains[chain].account}
                        </Typography>
                        <BasicMintApp
                            asset={asset}
                            network={network}
                            chain={chain}
                            providers={wallets.enabledChains}
                            account={wallets.enabledChains[chain].account}
                        />
                        <div>
                            <Typography
                                style={{ textTransform: "capitalize" }}
                                variant="h4"
                            >
                                Burn from {chain}
                            </Typography>
                            <Typography>
                                {asset} Balance: {balances[chain]}
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
                                    network={network}
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
