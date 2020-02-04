import * as React from "react";

import { TokenIcon } from "@renproject/react-components";

import { connect, ConnectedProps } from "../../state/connect";
import { Token } from "../../state/generalTypes";
import { SDKContainer } from "../../state/sdkContainer";
import { Popup } from "./Popup";

interface Props extends ConnectedProps<[SDKContainer]> {
}

/**
 * OpeningOrder is a visual component for allowing users to open new orders
 */
export const OpeningShiftMini = connect<Props & ConnectedProps<[SDKContainer]>>([SDKContainer])(
    ({ containers: [sdkContainer] }) => {
        const { shift } = sdkContainer.state;
        if (!shift) {
            throw new Error(`Unable to load shift details`);
        }

        const token = shift.shiftParams.sendToken.slice(0, 3) as Token;

        return <Popup mini={true}>
            <div className="side-strip"><TokenIcon token={token} /></div>
            <div className="popup--body--details">
                Continue
                </div>
        </Popup>;
    }
);
