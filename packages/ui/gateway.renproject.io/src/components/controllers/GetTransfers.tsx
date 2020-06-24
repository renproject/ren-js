import * as React from "react";

import { GatewayMessage, GatewayMessageType, HistoryEvent } from "@renproject/interfaces";
import { parse as parseLocation } from "qs";
import { RouteComponentProps, withRouter } from "react-router-dom";

import { DEFAULT_NETWORK } from "../../lib/environmentVariables";
import { _catchInteractionErr_ } from "../../lib/errors";
import { acknowledgeMessage, addMessageListener, postMessageToClient } from "../../lib/postMessage";
import { getStorage } from "../../lib/storage";
import { extractQuery } from "../../lib/utils";
import { connect, ConnectedProps } from "../../state/connect";
import { UIContainer } from "../../state/uiContainer";

/**
 * GetTransfers doesn't render any components. It listens for a
 * `GatewayMessageType.GetTransfers` message and returns the transfers stored.
 */
export const GetTransfers = withRouter(connect<RouteComponentProps & ConnectedProps<[UIContainer]>>([UIContainer])(
    ({ containers: [uiContainer], location }) => {

        React.useEffect(() => {
            const queryParams = parseLocation(location.search.replace(/^\?/, ""));
            const queryTransferID = extractQuery(queryParams.id, null);
            uiContainer.handleTransfer(queryTransferID).catch(console.error);
            const renNetwork = extractQuery(queryParams.network, DEFAULT_NETWORK);
            uiContainer.setState({ renNetwork }).catch(console.error);

            // tslint:disable-next-line: no-any
            addMessageListener((e: { data: GatewayMessage<any> }) => {
                if (e.data && e.data.from === "ren" && e.data.frameID === uiContainer.state.gatewayPopupID) {
                    (async () => {
                        switch (e.data.type) {
                            case GatewayMessageType.GetTransfers:
                                acknowledgeMessage(e.data);
                                const storage: Map<string, HistoryEvent> = await getStorage(uiContainer.state.renNetwork || renNetwork);
                                postMessageToClient(window, e.data.frameID, GatewayMessageType.Transfers, storage).catch(console.error);
                                break;
                            default:
                                // Acknowledge that we got the message. We don't
                                // know how to handle it, but we don't want
                                // the parent window to keep re-sending it.
                                acknowledgeMessage(e.data);
                        }
                    })().catch((error) => { _catchInteractionErr_(error, "Error in App: onMessage"); });
                }
            });
            if (queryTransferID) {
                postMessageToClient(window, queryTransferID, GatewayMessageType.Ready, {}).catch(console.error);
            }
        }, [location.search, uiContainer]);

        return <></>;
    }
));
