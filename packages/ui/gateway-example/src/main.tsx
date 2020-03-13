// tslint:disable: no-console react-this-binding-issue

import * as React from "react";

import { useEphemeralKey, useWeb3Network } from "@openzeppelin/network/react";
import GatewayJS, { ShiftInStatus, ShiftOutStatus } from "@renproject/gateway";
import { parse } from "qs";
import { HttpProvider } from "web3-providers";

interface InjectedEthereum extends HttpProvider {
    enable: () => Promise<void>;
}

// tslint:disable-next-line: no-any
type Web3 = any;

declare global {
    interface Window {
        ethereum?: InjectedEthereum;
        web3?: Web3;
    }
}

const startShiftIn = async (web3: Web3, gatewayJS: GatewayJS, amount: string, ethereumAddress: string) => {

    gatewayJS.send({
        web3Provider: web3.currentProvider,

        // Send BTC from the Bitcoin blockchain to the Ethereum blockchain.
        sendToken: GatewayJS.Tokens.BTC.Btc2Eth,

        // Amount of BTC we are sending (in Satoshis)
        sendAmount: GatewayJS.utils.value(amount, "btc").sats(),

        // The contract we want to interact with
        sendTo: ethereumAddress,

        // The nonce is used to guarantee a unique deposit address.
        nonce: GatewayJS.utils.randomNonce(),
    }).result()
        .on("status", (status) => { console.log(`[GOT STATUS] ${status}`); })
        .then(console.log)
        .catch(console.error);
};

// const startShiftOut = async (web3: Web3, gatewayJS: GatewayJS) => {
//     const amount = 0.000225; // BTC
//     const recipient = prompt("Enter ₿ Bitcoin address to receive BTC");
//     if (!recipient) { return; }

//     gatewayJS.send({
//         web3Provider: web3.currentProvider,

//         // Send BTC from the Bitcoin blockchain to the Ethereum blockchain.
//         sendToken: GatewayJS.Tokens.BTC.Eth2Btc,

//         // Amount of BTC we are sending (in Satoshis)
//         sendAmount: GatewayJS.utils.value(amount, "btc").sats().toFixed(),

//         // The contract we want to interact with
//         sendTo: recipient,
//     }).result()
//         .on("status", (status) => { console.log(`[GOT STATUS] ${status}`); })
//         .then(console.log)
//         .catch(console.error);
// };

const recoverTrades = async (web3: Web3, gatewayJS: GatewayJS) => {
    // Re-open incomplete trades
    const previousGateways = await gatewayJS.getGateways();
    for (const trade of Array.from(previousGateways.values())) {
        await gatewayJS
            .recoverShift(web3.currentProvider, trade)
            .pause()
            .result()
            .on("status", (status) => { console.log(`[GOT STATUS] ${status}`); })
            .then(console.log)
            .catch(console.error);
    }
};

export const GatewayExample = () => {

    const context = useWeb3Network(process.env.REACT_APP_ETHEREUM_NODE || "", {
        gsn: { signKey: useEphemeralKey() }
        // tslint:disable-next-line: no-any
    } as any);

    const urlParameters = parse(window.location.search, { ignoreQueryPrefix: true });

    // If the network is changed, `sendTo` should be changed too.
    const gatewayJS = React.useMemo(() => new GatewayJS(
        urlParameters.network || "testnet",
        { endpoint: urlParameters.endpoint || undefined },
    ), []);

    React.useEffect(() => {
        (async () => {

            recoverTrades(context.lib, gatewayJS).catch(console.error);
        })().catch(console.error);
    }, []);

    const [ethereumAddress, setEthereumAddress] = React.useState("");
    const [amount, setAmount] = React.useState("");

    const validAddress = React.useMemo(() => {
        return ethereumAddress.match(/^(0x)[0-9a-fA-Z]{40}$/);
    }, [ethereumAddress]);

    const [errorMessage, setErrorMessage] = React.useState(null as string | null);

    const onSubmit = React.useCallback(async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        if (!validAddress) {
            setErrorMessage("Please enter a valid Ethereum address.");
            return;
        }
        if (!amount) {
            setErrorMessage("Please enter a valid amount.");
            return;
        }
        setErrorMessage(null);
        try {
            await startShiftIn(context.lib, gatewayJS, amount, ethereumAddress);
        } catch (error) {
            setErrorMessage(String(error.message || error));
        }
    }, [startShiftIn, context.lib, gatewayJS, amount, ethereumAddress, validAddress]);

    return <>
        <form onSubmit={onSubmit} className="test-environment">
            <p className="box">Send Testnet BTC to an Ethereum address (Kovan).</p>

            <div className="send">
                <input value={ethereumAddress} onChange={(e) => { setEthereumAddress(e.target.value); }} placeholder="Ethereum address" />
            </div>

            <div className="send">
                <div className="send">
                    <input value={amount} onChange={(e) => { setAmount(e.target.value); }} placeholder="Amount" />
                    <div className="box">BTC</div>
                </div>
                <button type="submit" className={`blue ${!amount || !validAddress ? "disabled" : ""}`}>Send</button>
            </div>
            {errorMessage ? <p className="box red">{errorMessage}</p> : <></>}
        </form>
    </>;
};
