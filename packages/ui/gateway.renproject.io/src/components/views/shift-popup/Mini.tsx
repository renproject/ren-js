import * as React from "react";

import { TokenIcon } from "@renproject/react-components";

import { connect, ConnectedProps } from "../../../state/connect";
import { Token } from "../../../state/generalTypes";
import { SDKContainer } from "../../../state/sdkContainer";
import { Popup } from "../Popup";

export const Mini = ({ token, message }: { token: Token, message: string }) => {
    return <Popup mini={true}>
        <div className="side-strip"><TokenIcon token={token} /></div>
        <div className="popup--body--details">
            {message}
        </div>
    </Popup>;
};

interface Props extends ConnectedProps<[SDKContainer]> {
    message: string;
}

/**
 * OpeningOrder is a visual component for allowing users to open new orders
 */
export const ConnectedMini = connect<Props & ConnectedProps<[SDKContainer]>>([SDKContainer])(
    ({ message, containers: [sdkContainer] }) => {
        const { shift } = sdkContainer.state;
        if (!shift) {
            throw new Error(`Unable to load shift details`);
        }

        const token = shift.shiftParams.sendToken.slice(0, 3) as Token;

        return <Mini token={token} message={message} />;
    }
);
