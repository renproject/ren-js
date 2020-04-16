import * as React from "react";

import {
    BurnAndReleaseEvent, BurnAndReleaseParams, BurnAndReleaseStatus, EventType, GatewayMessage,
    GatewayMessageType, HistoryEvent, LockAndMintEvent, LockAndMintParams, LockAndMintStatus,
    SendTokenInterface, SerializableTransferParams,
} from "@renproject/interfaces";
import RenJS from "@renproject/ren";
import {
    Ox, processBurnAndReleaseParams, processLockAndMintParams, sleep, strip0x,
} from "@renproject/utils";
import { parse as parseLocation } from "qs";
import { RouteComponentProps, withRouter } from "react-router-dom";

import { DEFAULT_NETWORK } from "../../lib/environmentVariables";
import { _catchInteractionErr_ } from "../../lib/errors";
import { acknowledgeMessage, addMessageListener, postMessageToClient } from "../../lib/postMessage";
import { connect, ConnectedProps } from "../../state/connect";
import { SDKContainer } from "../../state/sdkContainer";
import { UIContainer } from "../../state/uiContainer";
import { ColoredBanner } from "../views/ColoredBanner";
// import { Footer } from "../views/Footer";
import { ErrorBoundary } from "./ErrorBoundary";
import { HandlingTransfer } from "./HandlingTransfer";
// import { TransferProgress } from "./ProgressBar";
import { getStorage, removeStorageTransfer } from "./Storage";

/**
 * App is the main visual component responsible for displaying different routes
 * and running background app loops
 */
export const Main = withRouter(connect<RouteComponentProps & ConnectedProps<[UIContainer, SDKContainer]>>([UIContainer, SDKContainer])(
    ({ containers: [uiContainer, sdkContainer], location }) => {

        const pause = React.useCallback(async (fromClient?: boolean) => {
            if (!fromClient) {
                const sendMsg = async () => {
                    if (uiContainer.state.gatewayPopupID) {
                        await postMessageToClient(window, uiContainer.state.gatewayPopupID, GatewayMessageType.Pause, {});
                    }
                };
                // The client send a pause or resume reminder message every
                // second, so there's a change that the user clicks pause or
                // resume just as the client sends the reminder.
                await sendMsg();
                setTimeout(sendMsg, 100);
            }
            return uiContainer.pause();
        }, [uiContainer]);

        const pauseOnClick = React.useCallback(() => pause(false), [pause]);

        const resume = React.useCallback(async (fromClient?: boolean) => {
            if (!fromClient) {
                const sendMsg = async () => {
                    if (uiContainer.state.gatewayPopupID) {
                        await postMessageToClient(window, uiContainer.state.gatewayPopupID, GatewayMessageType.Resume, {});
                    }
                };
                // See above on pausing.
                await sendMsg();
                setTimeout(sendMsg, 100);
            }
            return uiContainer.resume();
        }, [uiContainer]);

        const resumeOnClick = React.useCallback(() => resume(false), [resume]);

        const cancelTransfer = React.useCallback(async (fromClient?: boolean) => {
            let retries = 0;
            while (!sdkContainer.state.transfer || !uiContainer.state.renNetwork) {
                // Make errors less frequent as retries increase (by checking if retries is a square).
                if (Math.floor(Math.sqrt(retries)) ** 2 === retries) { console.error(`Waiting for transfer information to cancel transfer.`); }
                retries++;
                await sleep(100);
            }
            if (sdkContainer.state.transfer.transferParams.nonce) {
                await removeStorageTransfer(uiContainer.state.renNetwork, sdkContainer.state.transfer.transferParams.nonce);
                // TODO: Handle no nonce.
            }
            if (!fromClient && uiContainer.state.gatewayPopupID) {
                await sdkContainer.updateTransfer({ returned: true });
                await postMessageToClient(window, uiContainer.state.gatewayPopupID, GatewayMessageType.Cancel, {});
            }
        }, [uiContainer, sdkContainer]);

        const cancelOnClick = React.useCallback(() => cancelTransfer(false), [cancelTransfer]);

        React.useEffect(() => {

            const queryParams = parseLocation(location.search.replace(/^\?/, ""));
            const queryTransferID = queryParams.id;
            uiContainer.handleTransfer(queryTransferID).catch(console.error);

            const urlRenNetwork: string = queryParams.network || DEFAULT_NETWORK;
            uiContainer.setState({ renNetwork: urlRenNetwork }).catch(console.error);

            // tslint:disable-next-line: no-any
            addMessageListener((e: { data: GatewayMessage<any> }) => {
                const message = e.data;
                if (message && message.from === "ren" && message.frameID === uiContainer.state.gatewayPopupID) {
                    (async () => {
                        switch (message.type) {
                            case GatewayMessageType.TransferDetails:
                                acknowledgeMessage(message);
                                const { paused: alreadyPaused, transferDetails: transferParamsIn }: { paused: boolean, transferDetails: SerializableTransferParams | LockAndMintEvent | BurnAndReleaseEvent } = (message as GatewayMessage<GatewayMessageType.TransferDetails>).payload;
                                await (alreadyPaused ? pause() : resume());
                                const transferID = message.frameID;
                                const time = Date.now() / 1000;

                                const randomID = Ox(strip0x(transferID).repeat(4).slice(0, 64));

                                let historyEvent: HistoryEvent | undefined;
                                let transferParams: HistoryEvent["transferParams"];

                                if (transferParamsIn.hasOwnProperty("transferParams")) {
                                    historyEvent = transferParamsIn as unknown as HistoryEvent;
                                    transferParams = { ...historyEvent.transferParams };
                                    transferParams.nonce = transferParams.nonce || randomID;
                                } else {
                                    historyEvent = undefined;
                                    transferParams = {
                                        ...(transferParamsIn as (BurnAndReleaseParams & LockAndMintParams & SendTokenInterface)),
                                        nonce: (transferParamsIn as (BurnAndReleaseParams & LockAndMintParams & SendTokenInterface)).nonce || randomID,
                                    };
                                }

                                let transferDetails;

                                if (transferParams.sendToken === RenJS.Tokens.BTC.Btc2Eth ||
                                    transferParams.sendToken === RenJS.Tokens.ZEC.Zec2Eth ||
                                    transferParams.sendToken === RenJS.Tokens.BCH.Bch2Eth) {
                                    transferDetails = {
                                        // Cast required by TS to differentiate LockAndMint and BurnAndRelease types.
                                        eventType: EventType.LockAndMint as const,
                                        status: LockAndMintStatus.Committed,
                                        // tslint:disable-next-line: no-object-literal-type-assertion
                                        transferParams: processLockAndMintParams((sdkContainer.state.sdkRenVM || new RenJS(urlRenNetwork)).network, transferParams as LockAndMintParams) as LockAndMintEvent["transferParams"],
                                    };
                                } else {
                                    transferDetails = {
                                        eventType: EventType.BurnAndRelease as const,
                                        status: BurnAndReleaseStatus.Committed,
                                        transferParams: processBurnAndReleaseParams((sdkContainer.state.sdkRenVM || new RenJS(urlRenNetwork)).network, transferParams as BurnAndReleaseParams) as unknown as BurnAndReleaseEvent["transferParams"],
                                    };
                                }


                                historyEvent = {
                                    ...transferDetails,
                                    id: transferID,
                                    time,
                                    inTx: null,
                                    outTx: null,
                                    txHash: null,
                                    renVMStatus: null,
                                    renVMQuery: null,
                                    returned: false,
                                    ...historyEvent,
                                };

                                await sdkContainer.updateTransfer(historyEvent, { sync: true });

                                break;
                            case GatewayMessageType.Pause:
                                acknowledgeMessage(message);
                                pause(true).catch(console.error);

                                break;
                            case GatewayMessageType.Cancel:
                                acknowledgeMessage(message);
                                cancelTransfer(true).catch(console.error);
                                break;
                            case GatewayMessageType.Resume:
                                acknowledgeMessage(message);
                                resume(true).catch(console.error);
                                break;
                            case GatewayMessageType.GetTransfers:
                                acknowledgeMessage(message);
                                await postMessageToClient(window, message.frameID, GatewayMessageType.GetTransfers, await getStorage(urlRenNetwork));
                                break;
                            case GatewayMessageType.GetStatus:
                                acknowledgeMessage(message, sdkContainer.getTransferStatus());
                                break;
                            default:
                                // Acknowledge that we got the message. We don't
                                // know how to handle it, but we don't want
                                // the parent window to keep re-sending it.
                                acknowledgeMessage(message);
                        }
                    })().catch((error) => _catchInteractionErr_(error, "Error in App: onMessage"));
                }
            });
            postMessageToClient(window, queryTransferID, GatewayMessageType.Ready, {}).catch(console.error);
        }, []);

        // const login = React.useCallback(async () => {
        //     const queryParams = parseLocation(location.search.replace(/^\?/, ""));
        //     const urlRenNetwork: string = queryParams.network || DEFAULT_NETWORK;
        //     uiContainer.setState({ renNetwork: urlRenNetwork }).catch(console.error);

        //     // const πNetworkID = web3.eth.net.getId();
        //     // const πAddresses = web3.eth.getAccounts();

        //     // const networkID = await πNetworkID;
        //     const expectedNetworkID = (sdkContainer.state.sdkRenVM || new RenJS(urlRenNetwork)).network.contracts.networkID;
        //     const expectedNetwork = (sdkContainer.state.sdkRenVM || new RenJS(urlRenNetwork)).network.contracts.chainLabel;
        //     if (networkID !== expectedNetworkID) {
        //         await uiContainer.setState({ wrongNetwork: networkID, expectedNetwork });
        //         return;
        //     }
        //     // const addresses = await πAddresses;
        //     // const address = addresses.length > 0 ? addresses[0] : null;

        //     await Promise.all([
        //         uiContainer.connect(),
        //         sdkContainer.connect(urlRenNetwork),
        //     ]);

        // }, []);

        // useEffect replaces `componentDidMount` and `componentDidUpdate`.
        // To limit it to running once, we use the initialized hook.
        // const [initialized, setInitialized] = React.useState(false);
        // React.useEffect(() => {
        //     if (!initialized) {
        //         setInitialized(true);

        //         // Start loops to update prices and balances
        //         // setInterval(() => uiContainer.lookForLogout(), 1 * 1000);
        //         // login().catch((error) => { setInitialized(false); _catchInteractionErr_(error, "Error in App: login"); });
        //     }
        // }, [initialized, login, uiContainer]);

        React.useEffect(() => {
            const queryParams = parseLocation(location.search.replace(/^\?/, ""));
            const urlRenNetwork: string = queryParams.network || DEFAULT_NETWORK;
            uiContainer.setState({ renNetwork: urlRenNetwork }).catch(console.error);
            uiContainer.connect().catch(console.error);
            sdkContainer.connect(urlRenNetwork).catch(console.error);
        }, []);

        const { paused } = uiContainer.state;
        const { transfer } = sdkContainer.state;

        return <main className={paused ? "paused" : ""} onClick={paused ? resumeOnClick : undefined}>
            {/* {!paused ? <div className="banner"> */}
            {/* <span>Gateway {renNetwork === RenNetwork.Chaosnet || renNetwork === RenNetwork.Mainnet ? "by Ren Project" : <span className="warning"> {renNetwork}</span>}</span> */}
            {/* </div> : <></>} */}
            <div className="main">
                {!paused ? <ColoredBanner token={transfer && transfer.transferParams.sendToken} /> : <></>}
                {!paused && transfer ?
                    (transfer.status === LockAndMintStatus.Committed || transfer.status === BurnAndReleaseStatus.Committed) ?
                        <div role="button" className={`popup--cancel`} onClick={cancelOnClick}>Cancel</div> :
                        (transfer.status === LockAndMintStatus.ConfirmedOnEthereum || transfer.status === BurnAndReleaseStatus.ReturnedFromRenVM) ?
                            <></> :
                            <div role="button" className={`popup--x`} onClick={pauseOnClick} />
                    :
                    <></>
                }
                {transfer ? <ErrorBoundary>< HandlingTransfer /></ErrorBoundary> : <></>}
                {window === window.top ? <span className="not-in-iframe">See <a href="https://github.com/renproject/ren-js" target="_blank" rel="noopener noreferrer">github.com/renproject/ren-js</a> for more information about GatewayJS.</span> : <></>}
                {/* {!paused && transfer && sdkContainer.getNumberOfConfirmations() > 0 ? <TransferProgress /> : <></>} */}
            </div>
            {/* {!paused && <Footer />} */}
        </main>;
    }
));
