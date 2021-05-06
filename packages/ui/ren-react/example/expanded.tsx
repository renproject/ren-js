import * as React from "react";
import * as ReactDOM from "react-dom";

import {
    useDeposit,
    useLockAndMint,
    useBurnAndRelease,
    BurnStates,
    DepositStates,
    isBurnErroring,
    isOpen,
} from "@renproject/ren-react";
import RenJS from "@renproject/ren";
import { Ethereum } from "@renproject/chains-ethereum";
import { Zcash } from "@renproject/chains-bitcoin";
import Web3 from "web3";
import { useEffect, useMemo, useState } from "react";
import { RenNetwork } from "@renproject/interfaces";

const BurnApp = ({ account, provider, destinationAddress, balance }) => {
    const parameters = useMemo(
        () => ({
            sdk: new RenJS("testnet"),
            burnParams: {
                sourceAsset: "ZEC",
                network: RenNetwork.Testnet,
                destinationAddress,
                targetAmount: balance,
            },
            from: Ethereum(provider, "testnet").Account({
                address: account,
                value: balance,
            }),
            to: Zcash().Address(destinationAddress),
        }),
        [provider, account, balance],
    );

    const { value, session, burn, tx } = useBurnAndRelease(parameters);
    switch (value) {
        case BurnStates.CREATED:
            return (
                <button onClick={burn}>
                    Burn and release {Number(balance) / 10 ** 8}{" "}
                    {session.sourceAsset} to
                    {destinationAddress}
                </button>
            );
        case BurnStates.CONFIRMING_BURN:
            if (!tx) return <div>loading</div>;
            return (
                <div>
                    Waiting for burn confirmation {tx.sourceTxConfs} /
                    {tx.sourceTxConfTarget}
                </div>
            );
        case BurnStates.RENVM_RELEASING:
            return <div>Submitting to RenVM</div>;
        case BurnStates.RENVM_ACCEPTED:
            return <div>Releasing</div>;
        case BurnStates.RELEASED:
            return <div>Released</div>;
        case BurnStates.ERROR_BURNING:
            if (!isBurnErroring(session)) return <div>loading</div>;
            return <div>Couldn't burn: {session.error.message}</div>;
        case BurnStates.ERROR_RELEASING:
            return <div>Rejected</div>;
        default:
            return <div>Loading</div>;
    }
};

const MintApp = ({ account, provider }) => {
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
    const mint = useLockAndMint(parameters);
    if (!isOpen(mint.session)) return <div>Loading</div>;
    return (
        <div>
            Deposit {mint.session.sourceAsset} at {mint.session.gatewayAddress}
            {mint.deposits.map((x) => (
                <Deposit
                    key={x}
                    session={mint}
                    depositId={x}
                    currency={mint.session.sourceAsset}
                />
            ))}
        </div>
    );
};

const Deposit: React.FC<{
    session: ReturnType<typeof useLockAndMint>;
    depositId: string;
    currency: string;
}> = ({ session, depositId, currency }) => {
    const machine = useDeposit(session, depositId);
    if (!machine) return <div>Missing deposit...</div>;
    const { state, mint } = machine;
    if (state.matches(DepositStates.CONFIRMING_DEPOSIT)) {
        const deposit = state.context.deposit;
        return (
            <div>
                Waiting for deposit confirmation {deposit.sourceTxConfs}/
                {deposit.sourceTxConfTarget}
            </div>
        );
    }
    if (state.matches(DepositStates.RENVM_SIGNING)) {
        return <div>`Submitting to RenVM`</div>;
    }
    if (state.matches(DepositStates.RENVM_ACCEPTED)) {
        return (
            <button onClick={mint}>
                Mint {state.context.deposit.sourceTxAmount} {currency}?
            </button>
        );
    }
    if (state.matches(DepositStates.SUBMITTING_MINT)) {
        return <div>Minting...</div>;
    }
    if (
        state.matches(DepositStates.MINTING) ||
        state.matches(DepositStates.COMPLETED)
    ) {
        return (
            <div>Successfully minted: {state.context.deposit.destTxHash}</div>
        );
    }
    if (
        state.matches(DepositStates.ERROR_MINTING) ||
        state.matches(DepositStates.ERROR_SIGNING) ||
        state.matches(DepositStates.ERROR_RESTORING)
    ) {
        return (
            <div>
                Error processing: {state.context.deposit.error}; please refresh
            </div>
        );
    }
    if (state.matches(DepositStates.REJECTED)) {
        return <div>Deposit rejected {state.context.deposit.error}</div>;
    }
    return (
        <div>
            State: {state} id: {state.context.deposit.sourceTxHash}
        </div>
    );
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
                <h2>Mint</h2>
                <MintApp provider={provider} account={account} />
            </div>
            <div>
                <h2>Burn</h2>
                <div>Zec Balance: {balance}</div>
                <BurnApp
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
