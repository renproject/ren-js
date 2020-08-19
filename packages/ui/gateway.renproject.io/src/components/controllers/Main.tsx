import { BurnAndReleaseStatus, LockAndMintStatus } from "@renproject/interfaces";
import { Loading } from "@renproject/react-components";
import classNames from "classnames";
import { parse as parseLocation } from "qs";
import React from "react";
import { useLocation } from "react-router";

import { DEFAULT_NETWORK } from "../../lib/environmentVariables";
import { extractQuery, getAsset } from "../../lib/utils";
import { ReactComponent as AlertIcon } from "../../scss/images/alert.svg";
import { ReactComponent as MinimizeIcon } from "../../scss/images/icon-minimize.svg";
import { MessageContainer } from "../../state/messageContainer";
import { SDKContainer } from "../../state/sdkContainer";
import { TransferContainer } from "../../state/transferContainer";
import { UIContainer } from "../../state/uiContainer";
import { ColoredBanner } from "../views/ColoredBanner";
import { ErrorBoundary } from "../views/ErrorBoundary";
import { SettingsPage } from "../views/settingsPage/SettingsPage";
import { Tooltip } from "../views/tooltip/Tooltip";
import { HandlingTransfer } from "./HandlingTransfer";
import { NotIframe } from "./NotIframe";

const { version } = require("../../../package.json");

/**
 * App is the main visual component responsible for displaying different routes
 * and running background app loops
 */
export const Main: React.FC = () => {

    const location = useLocation();

    const { noLocalStorage } = TransferContainer.useContainer();
    const { paused, showingSettings, setRenNetwork, hideSettings } = UIContainer.useContainer();
    const { transfer, connect, canClearMintTransaction, clearMintTransaction, canClearLockTransaction, clearLockTransaction } = SDKContainer.useContainer();
    const { pause, resume, reportError, cancelTransfer } = MessageContainer.useContainer();

    const pauseOnClick = React.useCallback(() => pause(false), [pause]);
    const resumeOnClick = React.useCallback(() => resume(false), [resume]);

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
        const urlRenNetwork = extractQuery(queryParams.network, DEFAULT_NETWORK);
        setRenNetwork(urlRenNetwork);
        connect(urlRenNetwork).catch(console.error);
        setTimeout(() => { setDelayPassed(true); }, feedbackButtonDelay);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return (
        <main className={classNames("_ren", "main", paused ? "paused" : "")} onClick={paused ? resumeOnClick : undefined}>
            {/* Banner indicating the asset being transferred. */}
            {!paused ?
                <ErrorBoundary><ColoredBanner token={transfer && transfer.transferParams.sendToken} /></ErrorBoundary> :
                <></>
            }

            {/* Minimize button. */}
            {!paused && transfer && !(transfer.status === LockAndMintStatus.ConfirmedOnEthereum || transfer.status === BurnAndReleaseStatus.ReturnedFromRenVM) ?
                <ErrorBoundary><div role="button" className={`container--cancel`} onClick={pauseOnClick}><MinimizeIcon /></div></ErrorBoundary> :
                <></>
            }

            {/* Warning if local storage is not enabled. */}
            {!paused && noLocalStorage ?
                <ErrorBoundary><Tooltip className={`container--warning`} direction={"bottom"} width={250} contents={<span>GatewayJS uses localstorage as a back-up in case the integrator's storage fails. Proceed with caution.</span>}>
                    <span>No local storage</span>
                    <AlertIcon />
                </Tooltip></ErrorBoundary> :
                <></>
            }

            {/* Main transfer component. */}
            {transfer ?
                <ErrorBoundary>< HandlingTransfer /></ErrorBoundary> :
                <></>
            }

            {/* If the page is being viewed outside of an iFrame, show the version. */}
            {window === window.top ?
                <ErrorBoundary><NotIframe /></ErrorBoundary> :
                <></>
            }

            {/* If there's no transfer, show a loading screen for  the first 10 seconds and an error screen after that. */}
            {!transfer && window !== window.top ? <>
                {showFeedbackButton ?
                    <ErrorBoundary onClick={paused ? resumeOnClick : undefined} mini={paused} className="centered" manualError="Unable to load transfer details. Please disable browser shields, or enable browser cookies for the current site." fullPage={true} onCancel={onErrorBoundaryCancel} /> :
                    <Loading className="centered" />
                }
            </> : <></>}

            {/* Settings page. */}
            <ErrorBoundary>
                <SettingsPage
                    version={version}
                    asset={transfer && getAsset(transfer)}
                    hidden={!showingSettings || paused}
                    hideSettings={hideSettings}
                    cancelTransfer={cancelTransfer}
                    clearMintTransaction={canClearMintTransaction() ? clearMintTransaction : undefined}
                    clearLockTransaction={canClearLockTransaction() ? clearLockTransaction : undefined}
                    transfer={transfer}
                />
            </ErrorBoundary>
        </main>
    );
};
