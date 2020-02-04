import * as React from "react";

import { parse as parseLocation } from "qs";
import { RouteComponentProps, withRouter } from "react-router-dom";

import { _catchInteractionErr_ } from "../../lib/errors";
import {
    acknowledgeMessage, GatewayMessage, GatewayMessageType, postMessageToClient,
} from "../../lib/postMessage";
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

            // tslint:disable-next-line: no-any
            window.onmessage = (e: { data: GatewayMessage<any> }) => {
                if (e.data && e.data.from === "ren" && e.data.frameID === uiContainer.state.gatewayPopupID) {
                    (async () => {
                        switch (e.data.type) {
                            case GatewayMessageType.GetTrades:
                                acknowledgeMessage(e.data);
                                postMessageToClient(window, e.data.frameID, GatewayMessageType.GetTrades, await getStorage());
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
        }, []);

        return <></>;
    }
));
