import * as React from "react";

import RenJS from "@renproject/ren";
import { RouteComponentProps, withRouter } from "react-router-dom";

import { _catchBackgroundErr_, _catchInteractionErr_ } from "../../lib/errors";
import { getWeb3 } from "../../lib/getWeb3";
import { setIntervalAndRun } from "../../lib/utils";
import { connect, ConnectedProps } from "../../state/connect";
import { HistoryEvent, ShiftInStatus, ShiftOutStatus } from "../../state/generalTypes";
import { network, SDKContainer } from "../../state/sdkContainer";
import { UIContainer } from "../../state/uiContainer";
import { ReactComponent as Logo } from "../../styles/images/logo-small.svg";
import { ErrorBoundary } from "../ErrorBoundary";
import { LoggedOutPopup } from "../views/LoggedOutPopup";
import { OpeningOrder } from "./OpeningOrder";

/**
 * App is the main visual component responsible for displaying different routes
 * and running background app loops
 */
export const App = withRouter(connect<RouteComponentProps & ConnectedProps<[UIContainer, SDKContainer]>>([UIContainer, SDKContainer])(
    ({ containers: [uiContainer, sdkContainer], location }) => {

        const pause = () => {
            uiContainer.pause().catch((error) => _catchInteractionErr_(error, "Error in App: uiContainer.pause"));
            window.parent.postMessage({ from: "ren", type: "pause", payload: { msg: "demo return value" } }, "*");
        };

        const resume = () => {
            uiContainer.resume().catch((error) => _catchInteractionErr_(error, "Error in App: uiContainer.resume"));
            window.parent.postMessage({ from: "ren", type: "resume", payload: { msg: "demo return value" } }, "*");
        };

        React.useEffect(() => {
            window.onmessage = (e: any) => {
                if (e.data && e.data.from === "ren") {
                    console.log(`Message: ${e.data.type}`);
                    switch (e.data.type) {
                        case "shift":
                            (async () => {
                                const commitment = e.data.payload;
                                const time = Date.now() / 1000;
                                const currentOrderID = String(time);

                                // TODO: Clean up
                                const shift = commitment.sendToken === RenJS.Tokens.BTC.Btc2Eth || commitment.sendToken === RenJS.Tokens.ZEC.Zec2Eth || commitment.sendToken === RenJS.Tokens.BCH.Bch2Eth ? {
                                    // Cast required by TS to differentiate ShiftIn and ShiftOut types.
                                    shiftIn: true as true,
                                    status: ShiftInStatus.Committed,
                                } : {
                                        shiftIn: false as false,
                                        status: ShiftOutStatus.Committed,
                                    };

                                const nonce = RenJS.utils.randomNonce();

                                const historyEvent: HistoryEvent = {
                                    ...shift,
                                    id: currentOrderID,
                                    time,
                                    inTx: null,
                                    outTx: null,
                                    commitment,
                                    messageID: null,
                                    renVMStatus: null,
                                    nonce,
                                };

                                await sdkContainer.updateOrder(historyEvent);

                                await uiContainer.setState({
                                    confirmedTrade: false,
                                    currentOrderID: null,
                                });

                                await uiContainer.handleOrder(currentOrderID);
                            })().catch((error) => _catchInteractionErr_(error, "Error in APp: onMessage"));
                            break;
                        case "pause":
                            pause();
                            break;
                        case "resume":
                            resume();
                            break;
                    }
                }
            };
            window.parent.postMessage({ from: "ren", type: "ready", payload: {} }, "*");
        }, []);

        const login = React.useCallback(async () => {

            let web3 = uiContainer.state.web3;
            try {
                web3 = await getWeb3();
            } catch (error) {
                // ignore error
            }

            const πNetworkID = web3.eth.net.getId();
            const πAddresses = web3.eth.getAccounts();

            const networkID = await πNetworkID;
            if (network.contracts.networkID && networkID !== network.contracts.networkID) {
                alert(`Please switch to the ${network.contracts.chainLabel} Ethereum network.`);
                return;
            }
            const addresses = await πAddresses;
            const address = addresses.length > 0 ? addresses[0] : null;

            await Promise.all([
                uiContainer.connect(web3, address, networkID),
                sdkContainer.connect(web3, address, networkID),
            ]);

        }, [sdkContainer, uiContainer]);

        const logout = React.useCallback(async () => {
            await uiContainer.clearAddress();
        }, [uiContainer]);

        // useEffect replaces `componentDidMount` and `componentDidUpdate`.
        // To limit it to running once, we use the initialized hook.
        const [initialized, setInitialized] = React.useState(false);
        React.useEffect(() => {
            if (!initialized) {

                // Start loops to update prices and balances
                setIntervalAndRun(() => uiContainer.updateTokenPrices().catch(() => { /* ignore */ }), 30 * 1000);
                setInterval(() => uiContainer.lookForLogout(), 1 * 1000);
                login().then(() => {
                    setInitialized(true);
                }).catch((error) => _catchInteractionErr_(error, "Error in App: login"));
            }
        }, [initialized, uiContainer, location.search, login]);

        const { loggedOut } = uiContainer.state;

        const { currentOrderID, paused } = uiContainer.state;

        return <main className={paused ? "paused" : ""} onClick={paused ? resume : undefined}>
            {!paused ? <div className="banner">
                <Logo style={{ width: 40 }} /> <h1>RenVM</h1>
                {network.isTestnet ? <span className="testnet-badge">Testnet</span> : <></>}
                <div role="button" className={`popup--x`} onClick={pause} />
            </div> : <></>}
            <div className="main">
                <ErrorBoundary>
                    {currentOrderID ?
                        <OpeningOrder orderID={currentOrderID} /> :
                        <></>
                    }
                    {window === window.top ? <span className="not-in-iframe">See <a href="https://github.com/renproject/gateway-js" target="_blank" rel="noopener noreferrer">github.com/renproject/gateway-js</a> for more information about GatewayJS.</span> : <></>}
                </ErrorBoundary>
                {!paused ? <ErrorBoundary>
                    {loggedOut ?
                        <LoggedOutPopup oldAccount={loggedOut} /> :
                        <></>
                    }
                </ErrorBoundary> : <></>}
            </div>
            {!paused ? <div className="footer">
                <Logo style={{ width: 15 }} /> <h2>Gateway JS</h2>
            </div> : <></>}
        </main>;
    }
));
