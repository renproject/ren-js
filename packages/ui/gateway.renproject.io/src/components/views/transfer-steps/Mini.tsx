import * as React from "react";

import { TokenIcon } from "@renproject/react-components";

import { connect, ConnectedProps } from "../../../state/connect";
import { Token } from "../../../state/generalTypes";
import { SDKContainer } from "../../../state/sdkContainer";
import { Container } from "../Container";

export const Mini = ({ token, message }: { token: Token, message: string }) => {
    return <Container mini={true}>
        <div className="side-strip"><TokenIcon token={token} /></div>
        <div className="container--body--details">
            {message}
        </div>
    </Container>;
};

interface Props extends ConnectedProps<[SDKContainer]> {
    message: string;
}

/**
 * OpeningOrder is a visual component for allowing users to open new orders
 */
export const ConnectedMini = connect<Props & ConnectedProps<[SDKContainer]>>([SDKContainer])(
    ({ message, containers: [sdkContainer] }) => {
        const { transfer } = sdkContainer.state;
        if (!transfer) {
            throw new Error(`Unable to load transfer details`);
        }

        const token = transfer.transferParams.sendToken.slice(0, 3) as Token;

        return <Mini token={token} message={message} />;
    }
);
