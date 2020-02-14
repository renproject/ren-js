import * as React from "react";
import * as ReactDOM from "react-dom";

import GatewayJS, { ShiftInStatus, ShiftOutStatus } from "@renproject/gateway-js";

import "./style.scss";

// If the network is changed, `sendTo` should be changed too.
const gatewayJS = new GatewayJS("testnet");

const startShiftIn = async () => {
    const amount = 0.000225; // BTC
    const recipient = prompt("Enter Ethereum address to receive BTC");
    if (!recipient) { return; };

    gatewayJS.open({
        // Send BTC from the Bitcoin blockchain to the Ethereum blockchain.
        sendToken: GatewayJS.Tokens.BTC.Btc2Eth,

        // Amount of BTC we are sending (in Satoshis)
        suggestedAmount: GatewayJS.utils.value(amount, "btc").sats(),

        // The contract we want to interact with
        sendTo: "0xa2aE9111634F5983e4e1C3E3823914841a4c7235",

        // The name of the function we want to call
        contractFn: "shiftIn",

        // Arguments expected for calling `deposit`
        contractParams: [
            {
                name: "_to",
                type: "address",
                value: recipient,
            }
        ],

        // The nonce is used to guarantee a unique deposit address.
        nonce: GatewayJS.utils.randomNonce(),
    }).result()
        .on("status", (status) => console.log(`[GOT STATUS] ${status}`))
        .then(console.log)
        .catch(console.error);
};

const startShiftOut = async () => {
    const amount = 0.000225; // BTC
    const recipient = prompt("Enter Bitcoin address to receive BTC");
    if (!recipient) { return; };

    gatewayJS.open({
        // Send BTC from the Bitcoin blockchain to the Ethereum blockchain.
        sendToken: GatewayJS.Tokens.BTC.Eth2Btc,

        // Amount of BTC we are sending (in Satoshis)
        sendAmount: GatewayJS.utils.value(amount, "btc").sats().toFixed(),

        // The contract we want to interact with
        sendTo: recipient,
    }).result()
        .on("status", (status) => console.log(`[GOT STATUS] ${status}`))
        .then(console.log)
        .catch(console.error);
};


const recoverTrades = async () => {
    // Re-open incomplete trades
    const previousGateways = await gatewayJS.getGateways();
    for (const trade of Array.from(previousGateways.values())) {
        if (trade.status === ShiftInStatus.ConfirmedOnEthereum || trade.status === ShiftOutStatus.ReturnedFromRenVM) { continue; }
        const gateway = gatewayJS.open(trade);
        gateway.pause();
        gateway.result()
            .on("status", (status) => console.log(`[GOT STATUS] ${status}`))
            .then(console.log)
            .catch(console.error);
    }
}

const GatewayExample = () => {
    React.useEffect(() => { recoverTrades(); }, []);
    return <div className="test-background">
        <div className="test-banner"><div className="container"><h1>Testing Environment</h1></div></div>
        <div className="test-environment">
            <p className="box">To use this testing environment, you need to use a Web3 browser like Brave or Metamask for Firefox/Chrome.</p>
            <button onClick={startShiftIn} className="blue">Shift in with GatewayJS</button>
            <button onClick={startShiftOut} className="blue">Shift out with GatewayJS</button>
        </div>
    </div>;
}


ReactDOM.render(<GatewayExample />, document.getElementById("root") as HTMLElement);
