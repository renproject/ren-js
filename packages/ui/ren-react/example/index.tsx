import * as React from "react";
import * as ReactDOM from "react-dom";
import { useEffect, useMemo, useState } from "react";

import RenJS from "@renproject/ren";
import { BasicMint, BasicBurn } from "@renproject/ren-react";
import { Ethereum } from "@renproject/chains-ethereum";
import { Zcash } from "@renproject/chains-bitcoin";
import Web3 from "web3";
import { RenNetwork } from "@renproject/interfaces";

const BasicBurnApp = ({ account, provider, destinationAddress, balance }) => {
    const parameters = useMemo(
        () => ({
            sdk: new RenJS("testnet"),
            burnParams: {
                sourceAsset: "ZEC",
                network: RenNetwork.Testnet,
                targetAmount: balance,
                destinationAddress,
            },
            from: Ethereum(provider, "testnet").Account({
                address: account,
                value: balance,
            }),
            to: Zcash().Address(destinationAddress),
        }),
        [provider, account, balance],
    );
    return <BasicBurn parameters={parameters} />;
};

const BasicMintApp = ({ account, provider }) => {
    const parameters = useMemo(
        () => ({
            sdk: new RenJS("testnet"),
            mintParams: {
                sourceAsset: "ZEC",
                network: RenNetwork.Testnet,
                destinationAddress: account,
            },
            to: Ethereum(provider).Account({ address: account }),
            from: Zcash(),
        }),
        [provider, account],
    );
    return <BasicMint parameters={parameters} />;
};

const WithProvider = () => {
    const [provider, setProvider] = useState<any>();
    const [account, setAccount] = useState<string>();
    useEffect(() => {
        (window as any).ethereum.enable().then(async () => {
            const web3 = new Web3((window as any).ethereum);
            setAccount((await web3.eth.personal.getAccounts())[0]);
            setProvider((window as any).ethereum);
        });
    }, []);

    const [balance, setBalance] = useState<string>();
    useEffect(() => {
        if (!provider) return;
        Ethereum(provider, "testnet")
            .getBalance("ZEC", account)
            .then((v) => setBalance(v.minus(1000).toString()));
    }, [provider, setBalance]);

    if (!provider || !account || !balance) {
        return <div>Connect Wallet</div>;
    }

    return (
        <div>
            <div>
                <h2>Basic Mint</h2>
                <BasicMintApp provider={provider} account={account} />
            </div>
            <div>
                <h2>Basic Burn</h2>
                <div>Zec Balance: {balance}</div>
                <BasicBurnApp
                    provider={provider}
                    account={account}
                    destinationAddress={"tmCZ74c41byQKyVsA6xc8jMwXbQxKU16nJT"}
                    balance={200000}
                />
            </div>
        </div>
    );
};

ReactDOM.render(<WithProvider />, document.getElementById("root"));
