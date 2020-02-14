import * as React from "react";

import { GatewayMessage, GatewayMessageType, HistoryEvent } from "@renproject/ren-js-common";
import { parse as parseLocation } from "qs";
import { RouteComponentProps, withRouter } from "react-router-dom";

import { DEFAULT_NETWORK } from "../../lib/environmentVariables";
import { _catchInteractionErr_ } from "../../lib/errors";
import { acknowledgeMessage, postMessageToClient } from "../../lib/postMessage";
import { connect, ConnectedProps } from "../../state/connect";
import { UIContainer } from "../../state/uiContainer";
import { getStorage } from "./Storage";

/**
 * App is the main visual component responsible for displaying different routes
 * and running background app loops
 */
export const GetTrades = withRouter(connect<RouteComponentProps & ConnectedProps<[UIContainer]>>([UIContainer])(
    ({ containers: [uiContainer], location }) => {

        React.useEffect(() => {
            const queryParams = parseLocation(location.search.replace(/^\?/, ""));
            const queryShiftID = queryParams.id;
            uiContainer.handleShift(queryShiftID).catch(console.error);
            const renNetwork: string = queryParams.network || DEFAULT_NETWORK;
            uiContainer.setState({ renNetwork }).catch(console.error);

            // tslint:disable-next-line: no-any
            window.onmessage = (e: { data: GatewayMessage<any> }) => {
                if (e.data && e.data.from === "ren" && e.data.frameID === uiContainer.state.gatewayPopupID) {
                    (async () => {
                        switch (e.data.type) {
                            case GatewayMessageType.GetTrades:
                                acknowledgeMessage(e.data);
                                const storage: Map<string, HistoryEvent> = await getStorage(uiContainer.state.renNetwork || renNetwork);
                                postMessageToClient(window, e.data.frameID, GatewayMessageType.Trades, storage);
                                // `GetTrades` remains for backwards compatibility
                                postMessageToClient(window, e.data.frameID, GatewayMessageType.GetTrades, storage);
                                break;
                            default:
                                // Acknowledge that we got the message. We don't
                                // know how to handle it, but we don't want
                                // the parent window to keep re-sending it.
                                acknowledgeMessage(e.data);
                        }
                    })().catch((error) => _catchInteractionErr_(error, "Error in App: onMessage"));
                }
            };
            postMessageToClient(window, queryShiftID, GatewayMessageType.Ready, {});
        }, [location.search]);

        return <></>;
    }
));
