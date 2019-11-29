import * as React from "react";

import { TokenIcon } from "@renproject/react-components";

import { _catchInteractionErr_ } from "../../lib/errors";
import { connect, ConnectedProps } from "../../state/connect";
import { Token } from "../../state/generalTypes";
import { SDKContainer } from "../../state/sdkContainer";
import { Popup } from "./Popup";

interface Props extends ConnectedProps<[SDKContainer]> {
    orderID: string;
}

/**
 * OpeningOrder is a visual component for allowing users to open new orders
 */
export const OpeningOrderMini = connect<Props & ConnectedProps<[SDKContainer]>>([SDKContainer])(
    ({ orderID, containers: [sdkContainer] }) => {
        const order = sdkContainer.order(orderID);
        if (!order) {
            throw new Error(`Order ${orderID} not set`);
        }

        const token = order.commitment.sendToken.slice(0, 3) as Token;

        return <Popup mini={true}>
            <div className="side-strip"><TokenIcon token={token} /></div>
            <div className="popup--body--details">
                Continue
                </div>
        </Popup>;
    }
);
