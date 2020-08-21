import React from "react";
import CopyToClipboard from "react-copy-to-clipboard";
import styled from "styled-components";
import { darken } from "polished";

const BlueHover = styled.span`
    cursor: pointer;

    :hover {
        color: ${(p) => p.theme.primaryColor};
    }

    :active {
        color: ${(p) => darken(0.15, p.theme.primaryColor)};
    }
`;

export const ClickToCopy = ({ amount }: { amount: string }) => {
    return (
        <CopyToClipboard text={amount}>
            <BlueHover>{amount}</BlueHover>
        </CopyToClipboard>
    );
};
