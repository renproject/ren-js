import {
    Asset, BurnAndReleaseEvent, BurnAndReleaseStatus, GatewayMessageType,
} from "@renproject/interfaces";
import { Loading, sleep } from "@renproject/react-components";
import React from "react";

import { _catchInteractionErr_ } from "../../lib/errors";
import { postMessageToClient } from "../../lib/postMessage";
import { SDKContainer } from "../../state/sdkContainer";
import { UIContainer } from "../../state/uiContainer";
import { LogIn } from "../views/LogIn";
import { Complete } from "./pages/Complete";
import { SubmitBurnToEthereum } from "./pages/SubmitBurnToEthereum";
import { SubmitBurnToRenVM } from "./pages/SubmitBurnToRenVM";

interface Props {
    pressedDone: boolean;
    onDone: () => Promise<void>;
    showNotification: (title: string, body: string) => Promise<null>;
    requestNotificationPermission: () => Promise<{
        error?: string;
    } | null>;
}

/**
 * HandlingBurn displays the various steps of a burn-and-release.
 */
export const HandlingBurn: React.FC<Props> = ({
    onDone, pressedDone, showNotification, requestNotificationPermission,
}) => {
    const {
        paused, wrongNetwork, expectedNetwork, gatewayPopupID,
        resetTransfer,
    } = UIContainer.useContainer();
    const {
        updateTransfer, renJS, transfer,
        submitBurnToEthereum,
        submitBurnToRenVM,
    } = SDKContainer.useContainer();

    const [returned, setReturned] = React.useState(false);

    if (!transfer) {
        return <Loading />;
    }

    const onNoBurnFound = async () => {
        if (returned) {
            return;
        }
        setReturned(true);
        await sleep(0);
        if (gatewayPopupID) {
            await updateTransfer({ returned: true });
            await postMessageToClient(window, gatewayPopupID, GatewayMessageType.Error, { message: `No token burn found in transaction.` });
        }
        resetTransfer().catch((error) => { _catchInteractionErr_(error, "Error in HandlingTransfer: onNoBurnFound > resetTransfer"); });
    };

    if (!transfer) {
        throw new Error(`Unable to load transfer details`);
    }

    const { txHash, transferParams, renVMStatus } = transfer as BurnAndReleaseEvent;

    const token = transfer.transferParams.sendToken.slice(0, 3) as Asset;
    const txCount = (transferParams.contractCalls || []).length;

    if (!renJS || wrongNetwork) {
        return <>
            <LogIn correctNetwork={expectedNetwork || "correct"} token={token} paused={paused} wrongNetwork={wrongNetwork} />
        </>;
    }

    switch (transfer.status) {
        case BurnAndReleaseStatus.Committed:
        case BurnAndReleaseStatus.SubmittedToEthereum:
            return <SubmitBurnToEthereum
                token={token}
                txCount={txCount}
                networkDetails={renJS.network}
                mini={paused}
                txHash={transfer.inTx}
                submit={submitBurnToEthereum}
                ethereumConfirmations={transfer.ethereumConfirmations}
                requestNotificationPermission={requestNotificationPermission}
                showNotification={showNotification}
            />;
        case BurnAndReleaseStatus.ConfirmedOnEthereum:
        case BurnAndReleaseStatus.SubmittedToRenVM:
            return <SubmitBurnToRenVM
                token={token}
                mini={paused}
                renVMStatus={renVMStatus}
                txHash={txHash}
                submitDeposit={submitBurnToRenVM}
            />;
        case BurnAndReleaseStatus.NoBurnFound:
            onNoBurnFound().catch((error) => { _catchInteractionErr_(error, "Error in HandlingTransfer: burnAndRelease > onNoBurnFound"); });
            return <></>;
        case BurnAndReleaseStatus.ReturnedFromRenVM:
            return <Complete
                onDone={onDone}
                pressedDone={pressedDone}
                token={token}
                networkDetails={renJS.network}
                mini={paused}
                inTx={transfer.inTx}
                outTx={transfer.outTx}
            />;
    }
    return <></>;
};
