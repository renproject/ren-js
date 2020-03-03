import * as React from "react";
import * as ReactDOM from "react-dom";

import { parse } from "qs";
import GatewayJS, { ShiftInStatus, ShiftOutStatus } from "@renproject/gateway-js";

import "./style.scss";

const startShiftIn = async (gatewayJS: GatewayJS) => {
    const amount = 0.000225; // BTC
    const recipient = prompt("Enter Ξ Ethereum address to receive BTC");
    if (!recipient) { return; };

    gatewayJS.open({
        // Send BTC from the Bitcoin blockchain to the Ethereum blockchain.
        sendToken: GatewayJS.Tokens.BTC.Btc2Eth,

        // Amount of BTC we are sending (in Satoshis)
        suggestedAmount: GatewayJS.utils.value(amount, "btc").sats(),

        // The contract we want to interact with
        sendTo: recipient,

        // The nonce is used to guarantee a unique deposit address.
        nonce: GatewayJS.utils.randomNonce(),
    }).result()
        .on("status", (status) => console.log(`[GOT STATUS] ${status}`))
        .then(console.log)
        .catch(console.error);
};

const startShiftOut = async (gatewayJS: GatewayJS) => {
    const amount = 0.000225; // BTC
    const recipient = prompt("Enter ₿ Bitcoin address to receive BTC");
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


const recoverTrades = async (gatewayJS: GatewayJS) => {
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

    const urlParameters = parse(window.location.search, { ignoreQueryPrefix: true });
    console.log(urlParameters);

    // If the network is changed, `sendTo` should be changed too.
    const gatewayJS = React.useMemo(() => new GatewayJS(
        urlParameters.network || "testnet",
        { endpoint: urlParameters.endpoint || undefined },
    ), []);

    React.useEffect(() => { recoverTrades(gatewayJS); }, []);
    return <div className="test-background">
        <div className="test-banner"><div className="container"><h1>Testing Environment</h1></div></div>
        <div className="test-environment">
            <p className="box">To use this testing environment, you need to use a Web3 browser like Brave or Metamask for Firefox/Chrome.</p>
            <button onClick={() => startShiftIn(gatewayJS)} className="blue">Shift in with GatewayJS</button>
            <button onClick={() => startShiftOut(gatewayJS)} className="blue">Shift out with GatewayJS</button>
        </div>
    </div>;
}


ReactDOM.render(<GatewayExample />, document.getElementById("root") as HTMLElement);
