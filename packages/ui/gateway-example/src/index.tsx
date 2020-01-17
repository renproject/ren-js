import * as React from "react";
import * as ReactDOM from "react-dom";

import GatewayJS, { HistoryEvent } from "@renproject/gateway-js";
// TODO: Don't require RenJS to be imported
import RenJS from "@renproject/ren";
import BigNumber from "bignumber.js";

import "./style.scss";

const contractAddress = "0xa2aE9111634F5983e4e1C3E3823914841a4c7235";
const address = "0xa2aE9111634F5983e4e1C3E3823914841a4c7235";

// TODO: Export from gateway
export enum ShiftInStatus {
    Committed = "shiftIn_committed",
    Deposited = "shiftIn_deposited",
    SubmittedToRenVM = "shiftIn_submittedToRenVM",
    ReturnedFromRenVM = "shiftIn_returnedFromRenVM",
    SubmittedToEthereum = "shiftIn_submittedToEthereum",
    ConfirmedOnEthereum = "shiftIn_confirmedOnEthereum",
    RefundedOnEthereum = "shiftIn_refundedOnEthereum",
}

enum Endpoints {
    TESTNET = "testnet",
    CHAOSNET = "chaosnet",
    LOCALHOST = "http://localhost:3344/",
}

export const GatewayExample: React.FC<{}> = props => {

    const [endpoint, setEndpoint] = React.useState(Endpoints.TESTNET)
    const [recovering, setRecovering] = React.useState(false);
    const [opening, setOpening] = React.useState(false);
    const [error, setError] = React.useState(null as string | null);

    // Called when the main button is pressed.
    const startSwap = React.useCallback(async () => {
        setOpening(true);
        const amount = new BigNumber(0.000225);
        const gw = new GatewayJS(endpoint);
        const response = await gw.open({

            // Send BTC from the Bitcoin blockchain to the Ethereum blockchain.
            // TODO: Expose from GatewayJS
            sendToken: RenJS.Tokens.BTC.Btc2Eth,

            // Amount of BTC we are sending (in Satoshis)
            sendAmount: amount.times(10 ** 8).toNumber(), // Convert to Satoshis

            // The contract we want to interact with
            sendTo: contractAddress,

            // The name of the function we want to call
            contractFn: "shiftIn",

            // TODO: Expose from GatewayJS
            nonce: RenJS.utils.randomNonce(),

            // Arguments expected for calling `deposit`
            contractParams: [
                {
                    name: "_to",
                    type: "address",
                    value: address,
                }
            ],
        }).catch((error) => { setOpening(false); console.error(error); setError(error.message) });
        setOpening(false);
    }, [endpoint]);

    // Run once on load - check if there are any open trades that need to be
    // finished.
    const recoverTrades = React.useCallback(() => {
        setRecovering(true);
        (async () => {
            const gw = new GatewayJS(endpoint);
            // TODO: export trade type
            // tslint:disable-next-line: no-any
            const unfinishedTrades: Map<string, HistoryEvent> = await gw.unfinishedTrades();
            for (const trade of Array.from(unfinishedTrades.values())) {
                if (trade.status === ShiftInStatus.ConfirmedOnEthereum) {
                    continue;
                }
                const gw = new GatewayJS(endpoint);
                gw.open(trade.commitment);
                gw.pause();
                // await gw.cancel();
            }
        })().catch(error => { console.error("Error in TestEnvironment.tsx: unfinishedTrades", error); setError(error.message) });
    }, [endpoint]);

    return (
        <div className="test-background">
            <div className="test-banner"><div className="container">
                <h1>Testing Environment</h1>
            </div></div>
            <div className="test-environment">
                <div className="box">
                    <p>To use this testing environment, you need to use a Web3 browser like Brave or Metamask for Firefox/Chrome.</p>
                </div>
                <select disabled={opening || recovering} value={endpoint} onChange={e => setEndpoint(e.target.value as Endpoints)}>
                    <option value={Endpoints.TESTNET}>Testnet</option>
                    <option value={Endpoints.CHAOSNET}>Chaosnet</option>
                    <option value={Endpoints.LOCALHOST}>Localhost</option>
                </select>
                {error ? <div className="box">{error}</div> : <></>}
                <div>
                    <button disabled={recovering} onClick={recoverTrades}>Recover trades</button>
                </div>
                <div>
                    <button className="blue" onClick={startSwap}>Open GatewayJS</button>
                </div>
            </div>
        </div>
    );
};


ReactDOM.render(<GatewayExample />, document.getElementById("root") as HTMLElement);
