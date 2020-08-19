import { Asset, HistoryEvent } from "@renproject/interfaces";
import classNames from "classnames";
import React, { useCallback, useEffect, useState } from "react";

import { _catchInteractionErr_ } from "../../../lib/errors";
import infoIcon from "../../../scss/images/info.svg";
import { Popup } from "../popup/Popup";
import { Tooltip } from "../tooltip/Tooltip";
import { ExternalLink } from "../ExternalLink";

interface Props {
    version: string | undefined;
    asset: Asset | null;
    hidden: boolean;
    hideSettings: () => void;
    cancelTransfer: () => void;
    clearMintTransaction: (() => Promise<void>) | undefined;
    clearLockTransaction: (() => Promise<void>) | undefined;
    transfer: HistoryEvent | null;
}

export const SettingsPage: React.FunctionComponent<Props> = ({
    version, asset, hidden, hideSettings, cancelTransfer, clearMintTransaction, clearLockTransaction, transfer,
}) => {
    const [cancelling, setCancelling] = useState(false);
    const [clearingMintTransaction, setClearingMintTransaction] = useState(false);
    const [clearingLockTransaction, setClearingLockTransaction] = useState(false);

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

    const handleClearMintTransaction = useCallback(async () => {
        if (!clearMintTransaction) {
            return;
        }

        setClearingMintTransaction(true);
        try {
            await clearMintTransaction();
            hideSettings();
        } catch (error) {
            _catchInteractionErr_(error, "Error clearing mint transaction");
        }
        setClearingMintTransaction(false);
    }, [clearMintTransaction, setClearingMintTransaction]);

    const handleClearLockTransaction = useCallback(async () => {
        if (!clearLockTransaction) {
            return;
        }

        setClearingLockTransaction(true);
        try {
            await clearLockTransaction();
            hideSettings();
        } catch (error) {
            _catchInteractionErr_(error, "Error clearing lock transaction");
        }
        setClearingLockTransaction(false);
    }, [clearLockTransaction, setClearingLockTransaction]);

    const clearLockTooltip = "Only use this if you have replaced the transaction with a higher fee (RBF).";
    const clearMintTooltip = "Only use this if you have cancelled your Ethereum transaction in your wallet.";

    const onReportIssue = useCallback(() => {
        _catchInteractionErr_(new Error("Reporting issue"), {
            shownToUser: "Yes",
            description: "'Report issue' clicked",
            transfer,
            hash: transfer && transfer.txHash,
        });
    }, []);

    return <div className={classNames(`settings-page`, hidden ? "settings-page-hidden" : "")}>
        <div role="none" className="settings-overlay" onClick={hideSettings} />
        <div className="settings-bottom">

            {/* <p>Powered by <ExternalLink href="https://renproject.io/">RenVM</ExternalLink>.</p> */}

            <h2>Settings</h2>
            {version ? <span>GatewayJS Version {version}</span> : <></>}

            <div className="settings-options">
                <ExternalLink onClick={onReportIssue} href={"https://renprotocol.typeform.com/to/YdmFyB"} className="button-red"><span>Report issue →</span></ExternalLink>

                {/* <button disabled={hidden} onClick={hideTransfer}><span>Hide transfer</span></button> */}
                {clearLockTransaction ?
                    <button disabled={hidden || clearingLockTransaction} onClick={handleClearLockTransaction} className="button-red"><span><Tooltip direction={"top"} width={250} contents={<span>{clearLockTooltip}</span>}>Clear {asset ? asset.toUpperCase() : ""} transaction <img alt={clearLockTooltip} src={infoIcon} /></Tooltip></span></button> :
                    <></>
                }
                {clearMintTransaction ?
                    <button disabled={hidden || clearingMintTransaction} onClick={handleClearMintTransaction} className="button-red"><span><Tooltip direction={"top"} width={250} contents={<span>{clearMintTooltip}</span>}>Clear Ethereum transaction <img alt={clearMintTooltip} src={infoIcon} /></Tooltip></span></button> :
                    <></>
                }
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
