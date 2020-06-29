import { Asset } from "@renproject/interfaces";
import { TokenIcon } from "@renproject/react-components";
import React from "react";

import { Container, ContainerDetails } from "./Container";

export const Mini = ({ token, message }: { token: Asset, message: string }) => (
    <Container mini={true}>
        <div className="side-strip"><TokenIcon token={token} /></div>
        <ContainerDetails>
            <span>{message}</span>
        </ContainerDetails>
    </Container>
);
