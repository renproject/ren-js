import classNames from "classnames";
import React, { useCallback, useEffect, useState } from "react";

import { Popup } from "../popup/Popup";

interface Props {
    hidden: boolean;
    hideSettings: () => void;
    cancelTransfer: () => void;
}

export const SettingsPage: React.FunctionComponent<Props> = ({ hidden, hideSettings, cancelTransfer }) => {
    const [cancelling, setCancelling] = useState(false);

    const promptDeleteTransfer = useCallback(() => {
        setCancelling(true);
    }, []);

    const deleteTransfer = useCallback(() => {
        cancelTransfer();
        setCancelling(false);
    }, [cancelTransfer, setCancelling]);

    const cancelDeletion = useCallback(() => {
        setCancelling(false);
    }, [setCancelling]);

    // If user closes settings from Cog icon while prompt is shown, hide prompt.
    useEffect(() => {
        if (hidden) {
            hideSettings();
            if (cancelling) {
                setCancelling(false);
            }
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [hidden]);

    return <div className={classNames(`settings-page`, hidden ? "settings-page-hidden" : "")}>
        <div role="none" className="settings-overlay" onClick={hideSettings} />
        <div className="settings-bottom">

            {/* <p>Powered by <a href="https://renproject.io/" target="_blank" rel="noopener noreferrer">RenVM</a>.</p> */}

            <h2>Settings</h2>

            <div className="settings-options">
                {/* <button disabled={hidden} onClick={hideTransfer}><span>Hide transfer</span></button> */}
                <button disabled={hidden} onClick={promptDeleteTransfer} className="button-red"><span>Delete transfer</span></button>
            </div>

            {!hidden && cancelling ? <Popup closePopup={cancelDeletion} className="settings-prompt-deletion">
                <p>Are you sure? If the transfer has been initiated, funds won't be recoverable.</p>
                <div className="settings-prompt-deletion-buttons">
                    <button disabled={hidden} onClick={deleteTransfer} className="settings-confirm-deletion">Confirm deletion</button>
                    <button disabled={hidden} onClick={cancelDeletion} className="settings-cancel-deletion">Cancel</button>
                </div>
            </Popup> : <></>}
        </div>
    </div>;
};
