import * as React from "react";

import { Asset } from "@renproject/interfaces";

import { Container, ContainerDetails } from "../../views/Container";
import { Mini } from "../../views/Mini";

interface Props {
    mini: boolean;
    token: Asset;
}

export const InvalidParameters: React.StatelessComponent<Props> =
    ({ mini, token }) => {
        if (mini) {
            return <Mini token={token} message={"Invalid parameters"} />;
        }

        return <Container>
            <ContainerDetails>
                Invalid Parameters
            </ContainerDetails>
        </Container>;
    };
