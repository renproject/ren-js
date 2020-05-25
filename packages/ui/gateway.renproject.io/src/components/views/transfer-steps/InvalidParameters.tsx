import * as React from "react";

import { Asset } from "@renproject/interfaces";
import { lighten } from "polished";
import styled from "styled-components";

import { pulseAnimation } from "../../../scss/animations";
import { Container, ContainerDetails } from "../Container";
import { Mini } from "./Mini";

export const ScanningDot = styled.span`
            height: 10px;
            width: 10px;
            background-color: ${p => lighten(0.1, p.theme.primaryColor)};
            border-radius: 50%;
            display: block;
            margin-right: 10px;
            animation: ${p => pulseAnimation("6px", p.theme.primaryColor)};
            line-height: 100%;
            flex-shrink: 0;
        `;

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
