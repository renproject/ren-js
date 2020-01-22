import * as React from "react";
import * as ReactDOM from "react-dom";

import GatewayJS, { HistoryEvent } from "@renproject/gateway-js";
import BigNumber from "bignumber.js";

// TODO: Don't require RenJS to be imported
import "./style.scss";
import { getWeb3 } from "./web3";

const contractAddress = "0xa2aE9111634F5983e4e1C3E3823914841a4c7235";

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
    const startShiftIn = React.useCallback(async () => {
        setOpening(true);
        setError(null);
        const amount = new BigNumber(0.000225); // BTC
        const gw = new GatewayJS(endpoint);

        const web3 = await getWeb3();
        const accounts = await web3.eth.getAccounts();
        if (!accounts || !accounts.length) {
            setError("Must be logged in to a Web3 browser.");
            setOpening(false);
            return;
        }

        gw.open({

            // Send BTC from the Bitcoin blockchain to the Ethereum blockchain.
            sendToken: GatewayJS.Tokens.BTC.Btc2Eth,

            // Amount of BTC we are sending (in Satoshis)
            sendAmount: amount.times(10 ** 8).toNumber(), // Convert to Satoshis

            // The contract we want to interact with
            sendTo: contractAddress,

            // The name of the function we want to call
            contractFn: "shiftIn",

            // The nonce is used to guarantee a unique deposit address.
            nonce: GatewayJS.utils.randomNonce(),

            // Arguments expected for calling `deposit`
            contractParams: [
                {
                    name: "_to",
                    type: "address",
                    value: accounts[0],
                }
            ],
        })
            .result()
            .on("status", (status, details) => console.log(`[GOT STATUS] ${status} (${details})`))
            .then(result => { console.log(result); setOpening(false); })
            .catch(error => { setOpening(false); console.error(error); setError(error.message) });
    }, [endpoint]);

    // const startShiftOut = React.useCallback(async () => {
    //     setOpening(true);
    //     setError(null);
    //     const amount = new BigNumber(0.000225); // BTC
    //     const gw = new GatewayJS(endpoint);

    //     const web3 = await getWeb3();

    //     gw.open({

    //         // Send BTC from the Ethereum blockchain to the Bitcoin blockchain.
    //         // This is the reverse of shitIn.
    //         sendToken: GatewayJS.Tokens.BTC.Eth2Btc,

    //         // The web3 provider to talk to Ethereum
    //         web3Provider: web3.currentProvider,

    //         // The contract we want to interact with
    //         sendTo: contractAddress,

    //         // The name of the function we want to call
    //         contractFn: "shiftOut",

    //         // Arguments expected for calling `deposit`
    //         contractParams: [
    //             {
    //                 name: "_to",
    //                 type: "bytes",
    //                 value: address,
    //             },
    //             {
    //                 name: "_amount",
    //                 type: "uint256",
    //                 value: amount,
    //             }
    //         ],
    //     })
    //         .result()
    //         .on("status", (status, details) => console.log(`[GOT STATUS] ${status} (${details})`))
    //         .then(result => { console.log(result); setOpening(false); })
    //         .catch(error => { setOpening(false); console.error(error); setError(error.message) });
    // }, [endpoint]);

    // Run once on load - check if there are any open trades that need to be
    // finished.
    const recoverTrades = React.useCallback(() => {
        setRecovering(true);
        setError(null);
        (async () => {
            const gw = new GatewayJS(endpoint);
            // TODO: export trade type
            // tslint:disable-next-line: no-any
            const getGateways: Map<string, HistoryEvent> = await gw.getGateways();
            for (const trade of Array.from(getGateways.values())) {
                if (trade.status === ShiftInStatus.ConfirmedOnEthereum) {
                    continue;
                }
                const gw = new GatewayJS(endpoint).open(trade);
                gw.pause();
                (window as any).gw = gw;
                gw
                    .result()
                    .on("status", (status, details) => console.log(`[GOT STATUS] ${status} (${details})`))
                    .then(result => { console.log(result); })
                    .catch(error => { console.error(error); setError(error.message); });
            }
        })().catch(error => { console.error("Error in TestEnvironment.tsx: getGateways", error); setError(error.message) });
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
                <div>
                    <button disabled={recovering} onClick={recoverTrades}>Recover trades</button>
                </div>
                <div>
                    <button className="blue" onClick={startShiftIn}>Open GatewayJS</button>
                </div>
                {error ? <div className="box red">{error}</div> : <></>}
            </div>
        </div>
    );
};


ReactDOM.render(<GatewayExample />, document.getElementById("root") as HTMLElement);
