import * as React from "react";

import { Asset } from "@renproject/interfaces";
import { TokenIcon } from "@renproject/react-components";

import { Container, ContainerDetails } from "../Container";

export const Mini = ({ token, message }: { token: Asset, message: string }) => {
    return <Container mini={true}>
        <div className="side-strip"><TokenIcon token={token} /></div>
        <ContainerDetails>
            <span>{message}</span>
        </ContainerDetails>
    </Container>;
};
