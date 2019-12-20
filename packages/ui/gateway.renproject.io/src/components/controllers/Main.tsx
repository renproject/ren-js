import * as React from "react";

import RenJS, { BitcoinUTXO, UTXO } from "@renproject/ren";
import { RouteComponentProps, withRouter } from "react-router-dom";

import { ENABLE_TEST_ENDPOINT } from "../../lib/environmentVariables";
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
import styled from "styled-components";
import { Tooltip } from "../Tooltip";

const smallLogo = require("../../styles/images/logo-small-grey.png");

const Footer: React.FC<{}> = props => {
    const Container = styled.div`
    display: flex;
    align-items: center;
    justify-content: space-between;
    border-top: 1px solid #ccc;
    position: fixed;
    bottom:0;
    height: 30px;
    width: 100%;
    font-size: 12px;
    color: rgba(0, 0, 0, 0.4);
    padding: 0 30px;
    z-index: 100;
    &::before {
        content: '';
    }
    `;
    const RenVMLink = styled.a`
    text-decoration: underline;
    `;
    const infoIcon = require("../../styles/images/icons/info.svg");
    return (
        <Container>
<div>
            <img src={smallLogo} style={{width: "10px", marginRight: "5px"}} /><span>Powered by <RenVMLink href="https://renproject.io/renvm" target="_blank" rel="noopener noreferrer">RenVM</RenVMLink></span>
</div>
<div>
            <Tooltip contents={<p>Hello world!</p>}><img src={infoIcon} /></Tooltip>
</div>
        </Container>
    );
};

/**
 * App is the main visual component responsible for displaying different routes
 * and running background app loops
 */
export const Main = withRouter(connect<RouteComponentProps & ConnectedProps<[UIContainer, SDKContainer]>>([UIContainer, SDKContainer])(
    ({ containers: [uiContainer, sdkContainer], location }) => {

        const pause = () => {
            uiContainer.pause().catch((error) => _catchInteractionErr_(error, "Error in App: uiContainer.pause"));
            window.parent.postMessage({ from: "ren", type: "pause", payload: { msg: "demo return value" } }, "*");
        };

        const resume = () => {
            uiContainer.resume().catch((error) => _catchInteractionErr_(error, "Error in App: uiContainer.resume"));
            window.parent.postMessage({ from: "ren", type: "resume", payload: { msg: "demo return value" } }, "*");
        };

        const debugTestMessages = async (payload: any) => {
            // Make sure we're actually in a test environment
            if (!ENABLE_TEST_ENDPOINT) {
                return;
            }

            switch (payload) {
                case "confirming":
                    // Handle the deposit
                    const btcUtxo: BitcoinUTXO = {
                        txid: "0331c25055eb20129bd9beeb054b1f73d12f64a4917fa37a908e23ba0e287902",
                        value: 5678965,
                        script_hex: "something",
                        output_no: 1,
                        confirmations: 1,
                    };
                    const utxo: UTXO = {
                        chain: RenJS.Chains.Bitcoin,
                        utxo: btcUtxo,
                    };
                    await uiContainer.deposit(utxo);
                    break;
                case "confirmed":
                    await sdkContainer.updateOrder({ status: ShiftInStatus.Deposited });
                    break;
                case "renvm-signed":
                    const hash = RenJS.utils.Ox(Buffer.from("a4c139cf8e4795a3cb2ce8f12457ce502aa5b9db0535e9e374218c57c76c6ef5", "base64"));
                    await sdkContainer.updateOrder({
                        inTx: {
                            hash,
                            chain: RenJS.Chains.Bitcoin,
                        },
                        status: ShiftInStatus.ReturnedFromRenVM,
                    });
                    break;
                case "submit-to-eth":
                    const ethHash = "0xc9dec50563a30bb19100cece73e0396fe63523eb50c4c5f36a1530a0ee3991d8";
                    await sdkContainer.updateOrder({
                        status: ShiftInStatus.SubmittedToEthereum,
                        outTx: { hash: ethHash, chain: RenJS.Chains.Ethereum },
                    });
                    break;

                case "eth-confirmed":
                    const ethHash2 = "0xc9dec50563a30bb19100cece73e0396fe63523eb50c4c5f36a1530a0ee3991d8";
                    await sdkContainer.updateOrder({
                        outTx: { hash: ethHash2, chain: RenJS.Chains.Ethereum },
                        status: ShiftInStatus.RefundedOnEthereum,
                    });
                    break;
            }
        };

        React.useEffect(() => {
            window.onmessage = (e: any) => {
                if (e.data && e.data.from === "ren") {
                    console.log(`Message: ${e.data.type}`);
                    (async () => {
                        switch (e.data.type) {
                            case "shift":
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
                                break;
                            case "test":
                                await debugTestMessages(e.data.payload);
                                break;
                            case "pause":
                                pause();
                                break;
                            case "resume":
                                resume();
                                break;

                        }
                    })().catch((error) => _catchInteractionErr_(error, "Error in App: onMessage"));
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
                <span>{uiContainer.state.status}</span>
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
            <Footer />
        </main>;
    }
));
