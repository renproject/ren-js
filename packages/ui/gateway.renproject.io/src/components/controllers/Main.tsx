import * as React from "react";

import {
    BurnAndReleaseEvent, BurnAndReleaseParams, BurnAndReleaseStatus, Chain, EventType,
    GatewayMessage, GatewayMessageType, HistoryEvent, LockAndMintEvent, LockAndMintParams,
    LockAndMintStatus, SendTokenInterface, SerializableTransferParams,
} from "@renproject/interfaces";
import { Loading } from "@renproject/react-components";
import RenJS from "@renproject/ren";
import {
    Ox, processBurnAndReleaseParams, processLockAndMintParams, strip0x,
} from "@renproject/utils";
import { parse as parseLocation } from "qs";
import { RouteComponentProps, withRouter } from "react-router-dom";

import { ReactComponent as MinimizeIcon } from "../../images/icon-minimize.svg";
import { DEFAULT_NETWORK } from "../../lib/environmentVariables";
import { _catchInteractionErr_ } from "../../lib/errors";
import { acknowledgeMessage, addMessageListener, postMessageToClient } from "../../lib/postMessage";
import { connect, ConnectedProps } from "../../state/connect";
import { SDKContainer } from "../../state/sdkContainer";
import { UIContainer } from "../../state/uiContainer";
import { ColoredBanner } from "../views/ColoredBanner";
import { ExternalLink } from "../views/ExternalLink";
import { SettingsPage } from "../views/settingsPage/SettingsPage";
// import { Footer } from "../views/Footer";
import { ErrorBoundary } from "./ErrorBoundary";
import { HandlingTransfer } from "./HandlingTransfer";
// import { TransferProgress } from "./ProgressBar";
import { getStorage } from "./Storage";

const { version } = require("../../../package.json");

/**
 * App is the main visual component responsible for displaying different routes
 * and running background app loops
 */
export const Main = withRouter(connect<RouteComponentProps & ConnectedProps<[UIContainer, SDKContainer]>>([UIContainer, SDKContainer])(
    ({ containers: [uiContainer, sdkContainer], location }) => {

        const reportError = React.useCallback(async (errorMessage: string) => {
            if (uiContainer.state.gatewayPopupID) {
                await postMessageToClient(window, uiContainer.state.gatewayPopupID, GatewayMessageType.Error, { message: errorMessage });
            }
        }, [uiContainer]);

        const pause = React.useCallback(async (fromClient?: boolean) => {
            if (!fromClient) {
                if (uiContainer.state.gatewayPopupID) {
                    await postMessageToClient(window, uiContainer.state.gatewayPopupID, GatewayMessageType.Pause, {});
                }
            }
            return uiContainer.pause();
        }, [uiContainer]);

        const pauseOnClick = React.useCallback(() => pause(false), [pause]);

        const resume = React.useCallback(async (fromClient?: boolean) => {
            if (!fromClient) {
                if (uiContainer.state.gatewayPopupID) {
                    await postMessageToClient(window, uiContainer.state.gatewayPopupID, GatewayMessageType.Resume, {});
                }
            }
            return uiContainer.resume();
        }, [uiContainer]);

        const resumeOnClick = React.useCallback(() => resume(false), [resume]);

        const cancelTransfer = React.useCallback(async (fromClient?: boolean) => {
            if (!sdkContainer.state.transfer || !uiContainer.state.renNetwork) {
                _catchInteractionErr_(new Error("Missing transfer or network details for cancelTransfer"), "Error in Main.tsx > cancelTransfer");
                return;
            }

            if (sdkContainer.state.transfer.transferParams.nonce) {
                await sdkContainer.updateTransfer({ archived: true }, { force: true });
                // await removeStorageTransfer(uiContainer.state.renNetwork, sdkContainer.state.transfer.transferParams.nonce);
                // TODO: Handle no nonce.
            }
            if (!fromClient && uiContainer.state.gatewayPopupID) {
                await sdkContainer.updateTransfer({ returned: true });
                await postMessageToClient(window, uiContainer.state.gatewayPopupID, GatewayMessageType.Cancel, {});
            }
        }, [uiContainer, sdkContainer]);

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
                                const { cancelled: alreadyCancelled, paused: alreadyPaused, transferDetails: transferParamsIn }: { cancelled: boolean, paused: boolean, transferDetails: SerializableTransferParams | LockAndMintEvent | BurnAndReleaseEvent } = (message as GatewayMessage<GatewayMessageType.TransferDetails>).payload;
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

                                if (alreadyCancelled && historyEvent.transferParams.nonce) {
                                    // await removeStorageTransfer(urlRenNetwork, historyEvent.transferParams.nonce);
                                    await sdkContainer.updateTransfer({ archived: true }, { force: true });
                                }

                                if (!historyEvent.transferParams.sendToken) {
                                    reportError("No sendToken provided").catch(console.error);
                                }

                                await sdkContainer.updateTransfer(historyEvent, { sync: true });

                                break;
                            case GatewayMessageType.ToggleSettings:
                                acknowledgeMessage(message);
                                uiContainer.toggleSettings().catch(console.error);

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
                            case GatewayMessageType.SendEthereumTxConfirmations:
                                acknowledgeMessage(message);
                                const { txHash, confirmations: ethereumConfirmations } = (message as GatewayMessage<GatewayMessageType.SendEthereumTxConfirmations>).payload;
                                // Check that the txHash matches what's stored in the store.
                                if (sdkContainer.state.transfer && sdkContainer.state.transfer.eventType === EventType.BurnAndRelease && sdkContainer.state.transfer.inTx && sdkContainer.state.transfer.inTx.chain === Chain.Ethereum && sdkContainer.state.transfer.inTx.hash === txHash) {
                                    await sdkContainer.updateTransfer({ ethereumConfirmations });
                                }
                                break;
                            default:
                                // Acknowledge that we got the message. We don't
                                // know how to handle it, but we don't want
                                // the parent window to keep re-sending it.
                                acknowledgeMessage(message);
                        }
                    })().catch((error) => { _catchInteractionErr_(error, "Error in App: onMessage"); });
                }
            });
            postMessageToClient(window, queryTransferID, GatewayMessageType.Ready, {}).catch(console.error);
            // eslint-disable-next-line react-hooks/exhaustive-deps
        }, []);

        // If the transfer details haven't loaded after 10 seconds, show an
        // error message and feedback button.
        const feedbackButtonDelay = 10 * 1000;
        const [delayPassed, setDelayPassed] = React.useState(false);
        const [showFeedbackButton, setShowFeedbackButton] = React.useState(false);
        const onErrorBoundaryCancel = React.useCallback(() => reportError("Unable to load transfer details."), [reportError]);
        React.useEffect(() => {
            if (delayPassed) {
                setShowFeedbackButton(true);
            }
        }, [delayPassed]);

        React.useEffect(() => {
            const queryParams = parseLocation(location.search.replace(/^\?/, ""));
            const urlRenNetwork: string = queryParams.network || DEFAULT_NETWORK;
            uiContainer.setState({ renNetwork: urlRenNetwork }).catch(console.error);
            uiContainer.connect().catch(console.error);
            sdkContainer.connect(urlRenNetwork).catch(console.error);
            setTimeout(() => { setDelayPassed(true); }, feedbackButtonDelay);
            // eslint-disable-next-line react-hooks/exhaustive-deps
        }, []);

        const { paused, showingSettings } = uiContainer.state;
        const { transfer } = sdkContainer.state;

        return <main className={paused ? "paused" : ""} onClick={paused ? resumeOnClick : undefined}>
            {/* {!paused ? <div className="banner"> */}
            {/* <span>Gateway {renNetwork === RenNetwork.Chaosnet || renNetwork === RenNetwork.Mainnet ? "by Ren Project" : <span className="warning"> {renNetwork}</span>}</span> */}
            {/* </div> : <></>} */}
            <div className="main">
                {!paused ? <ColoredBanner token={transfer && transfer.transferParams.sendToken} /> : <></>}
                {!paused && transfer ?
                    // (transfer.status === LockAndMintStatus.Committed || transfer.status === BurnAndReleaseStatus.Committed) ?
                    // <div role="button" className={`container--cancel`} onClick={cancelOnClick}><CancelIcon /></div> :
                    (transfer.status === LockAndMintStatus.ConfirmedOnEthereum || transfer.status === BurnAndReleaseStatus.ReturnedFromRenVM) ?
                        <></> :
                        <div role="button" className={`container--cancel`} onClick={pauseOnClick}><MinimizeIcon /></div>
                    :
                    <></>
                }
                {transfer ? <ErrorBoundary>< HandlingTransfer /></ErrorBoundary> : <></>}
                <ErrorBoundary><SettingsPage hidden={!showingSettings || paused} hideSettings={uiContainer.hideSettings} cancelTransfer={cancelTransfer} /></ErrorBoundary>
                {window === window.top ? <span className="not-in-iframe">
                    <h1>GatewayJS</h1>
                    <p>Version {version}</p>
                    <p>See <ExternalLink href="https://github.com/renproject/ren-js">github.com/renproject/ren-js</ExternalLink> for more information about GatewayJS.</p>
                </span> : <></>}
                {!transfer && window !== window.top ? <>
                    {showFeedbackButton ? <ErrorBoundary mini={paused} className="centered" manualError="Unable to load transfer details." fullPage={true} onCancel={onErrorBoundaryCancel} /> : <Loading className="centered" />}
                </> : <></>}
                {/* {!paused && transfer && sdkContainer.getNumberOfConfirmations() > 0 ? <TransferProgress /> : <></>} */}
            </div>
            {/* {!paused && <Footer />} */}
        </main>;
    }
));
