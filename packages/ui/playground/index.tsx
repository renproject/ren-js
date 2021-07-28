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
    BurnConfigMultiple,
    MintConfigMultiple,
} from "../../ui/ren-react/src/library/index";
import { EthereumConfig } from "../../lib/chains/chains-ethereum/src";
import { Solana } from "../../lib/chains/chains-solana/src";
import { MintChain, RenNetwork } from "@renproject/interfaces";
import {
    WalletPickerModal,
    MultiwalletProvider,
    useMultiwallet,
} from "@renproject/multiwallet-ui";
import { RenVMProvider } from "@renproject/rpc/build/main/v2/renVMProvider";
import { multiwalletOptions } from "./multiwallet";
import {
    burnChainMap,
    chainStringToRenChain,
    lockChainMap,
    mintChainMap,
    releaseChainMap,
} from "./chainmaps";
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
    publicProvider: () => "",
    explorer: { address: () => "", transaction: () => "" },
    etherscan: "https://etherscan.io",
    addresses: {
        GatewayRegistry: "0x0Bb909b7c3817F8fB7188e8fbaA2763028956E30",
        BasicAdapter: "0x809fd89454819d7f71B01a2f3dAC377E6a87FBCE",
    },
};

const source = {
    BTC: "bitcoin",
    ZEC: "zcash",
    BCH: "bitcoinCash",
    FIL: "filecoin",
    DGB: "digiByte",
    DOGE: "dogecoin",
    LUNA: "terra",
};
const supportedAssets = ["BTC", "ZEC", "BCH", "FIL", "LUNA", "DGB", "DOGE"];
const renNetworks = [...Object.values(RenNetwork)];

const BasicBurnApp = ({
    network,
    account,
    sourceChain,
    sourceAsset,
    destinationChain,
    providers,
    destinationAddress,
    amount,
}) => {
    const parameters: BurnConfigMultiple = useMemo(
        () => ({
            debug: true,
            sdk: new RenJS(network, { useV2TransactionFormat: true }) as any,
            burnParams: {
                sourceAsset,
                network,
                targetAmount: amount,
                destinationAddress,
            },
            network,
            sourceChain,
            destinationChain,
            userAddress: account,
            customParams: {},
            fromMap: burnChainMap(providers),
            toMap: releaseChainMap,
        }),
        [providers, account, amount, destinationAddress],
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
    }, [providers, chain, network]);

    // ensure that the solana mint destination exists
    useEffect(() => {
        let canceled = false;
        if (!tokenAccountExists && solanaMintChain) {
            solanaMintChain
                .createAssociatedTokenAccount(asset)
                .then(() => {
                    if (canceled) return;
                    setTokenAccountExists(true);
                })
                .catch((e) => {
                    if (canceled) return;
                    setTokenAccountError("Failed to create token account");
                });
        }
        return () => {
            canceled = true;
        };
    }, [solanaMintChain, tokenAccountExists, setTokenAccountExists, asset]);

    const parameters: MintConfigMultiple = useMemo(
        () => ({
            sdk: new RenJS(network, {
                loadCompletedDeposits: true,
                useV2TransactionFormat: true,
            }) as any,
            mintParams: {
                network,
                sourceAsset: asset,
                destinationAddress: account,
            },
            debug: true,
            sourceChain: source[asset],
            userAddress: account,
            destinationChain: chain,
            toMap: mintChainMap(providers),
            fromMap: lockChainMap,
            customParams: {},
        }),
        [providers, account, network, asset, source, lockChainMap],
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

const ConnectToChain = ({ setOpen, setChain, network }) => {
    return (
        <Paper style={{ margin: "1em" }}>
            {Object.keys(multiwalletOptions(network).chains).map((chain) => (
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
    const [chain, setChain] =
        useState<keyof ReturnType<typeof multiwalletOptions>["chains"]>(
            "solana",
        );
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
    const [decimals, setDecimals] = useState<{
        [chain: string]: { [asset: string]: number };
    }>({});
    useEffect(() => {
        Object.entries(wallets.enabledChains).map(
            async ([chain, connector]) => {
                const provider = connector.provider as any;
                const account = connector.account as string;

                if (!provider || !account) return;
                const mintChain: MintChain = chainStringToRenChain[chain](
                    provider,
                    network,
                );
                const balance = await mintChain.getBalance(asset, account);
                setBalances((balances) => ({
                    ...balances,
                    [chain]: balance.toString(),
                }));

                const decimals = await mintChain.assetDecimals(asset);
                setDecimals((oldDecimals) => ({
                    ...oldDecimals,
                    [chain]: {
                        ...oldDecimals[chain],
                        [asset]: decimals,
                    },
                }));
            },
        );
    }, [wallets, setBalances, setDecimals]);

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
                setOpen={setOpen}
                network={network}
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
                .filter((chain) => {
                    return (
                        wallets.enabledChains[chain].provider &&
                        wallets.enabledChains[chain].account
                    );
                })
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
                                {asset} Balance:{" "}
                                {Number(balances[chain]) /
                                    10 ** (decimals[chain] || {})[asset]}
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
                                    providers={wallets.enabledChains}
                                    network={network}
                                    sourceChain={chain}
                                    sourceAsset={asset}
                                    destinationChain={source[asset]}
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
