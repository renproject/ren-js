import { GatewayMessageType, UnmarshalledTx } from "@renproject/interfaces";
import { Loading, sleep } from "@renproject/react-components";
import React from "react";

import { _catchInteractionErr_ } from "../../lib/errors";
import { postMessageToClient } from "../../lib/postMessage";
import { SDKContainer } from "../../state/sdkContainer";
import { UIContainer } from "../../state/uiContainer";
import { ErrorBoundary } from "../views/ErrorBoundary";
import { TransferDetails } from "../views/TransferDetails";
import { HandlingBurn } from "./HandlingBurn";
import { HandlingMint } from "./HandlingMint";

/**
 * HandlingTransfer is a visual component for allowing users to start new transfers
 */
export const HandlingTransfer: React.FC = () => {
    const {
        paused, gatewayPopupID,
        resetTransfer,
    } = UIContainer.useContainer();
    const {
        updateTransfer, transfer, queryTransferStatus,
    } = SDKContainer.useContainer();

    const [pressedDone, setPressedDone] = React.useState(false);
    const onDone = React.useCallback(async () => {
        await sleep(0);
        setPressedDone(true);
        let response: {} | UnmarshalledTx = {};
        try {
            response = await queryTransferStatus();
        } catch (error) {
            _catchInteractionErr_(error, { description: "Error in Main.tsx: onDone > queryTransferStatus" });
        }
        if (gatewayPopupID) {
            await updateTransfer({ returned: true });
            await sleep(100);
            await postMessageToClient(window, gatewayPopupID, GatewayMessageType.Done, response);
        }
        resetTransfer().catch((error) => { _catchInteractionErr_(error, "Error in HandlingTransfer: onDone > resetTransfer"); });
        setPressedDone(false);
    }, [gatewayPopupID, updateTransfer, queryTransferStatus, resetTransfer]);

    const requestNotificationPermission = React.useCallback(async () => gatewayPopupID ? await postMessageToClient(window, gatewayPopupID, GatewayMessageType.RequestNotificationPermission, {}) : null, [gatewayPopupID]);
    const showNotification = React.useCallback(async (title: string, body: string) => {
        if (gatewayPopupID) {
            return await postMessageToClient(window, gatewayPopupID, GatewayMessageType.ShowNotification, { title, body });
        }
        return null;
    }, [gatewayPopupID]);

    if (!transfer) {
        return <Loading />;
    }

    const isBurn = transfer.transferParams.sendToken.slice(4, 7).toLowerCase() === "eth";

    return <>
        {isBurn ?
            <HandlingBurn
                pressedDone={pressedDone}
                onDone={onDone}
                showNotification={showNotification}
                requestNotificationPermission={requestNotificationPermission}
            /> :
            <HandlingMint
                pressedDone={pressedDone}
                onDone={onDone}
                showNotification={showNotification}
                requestNotificationPermission={requestNotificationPermission}
            />
        }
        {!paused ? <ErrorBoundary><TransferDetails
            transfer={transfer}
        /></ErrorBoundary> : <></>}
    </>;
};
