import * as React from "react";
import styled from "styled-components";

import { lighten } from "polished";

export const LabelledInput = (props: any) => {
    const {inputLabel, children, width, ...rest} = props;
    const setWidth = width ? width : 210;
    const StyledInput = styled.input`
    color: ${p => lighten(0.1, p.theme.primaryColor)} !important;
    font-size: 14px !important;
    font-weight: 400 !important;
    `;

    const w = 105 + (210 - setWidth) / 2;
    const DepositLabel = styled.label`
    position: absolute;
    top: 0;
    width: ${setWidth}px;
    text-align: center;
    margin-left: ${w}px;
    font-size: 14px;
    color: ${p => p.theme.lightGrey};
    background-color: white;
    margin-top: -10px;
    `;

    const OuterDiv = styled.div`
    position: relative;
    `;

    return (
        <OuterDiv>
            <StyledInput type="text" {...rest} />
            <DepositLabel>{inputLabel}</DepositLabel>
            {props.children}
        </OuterDiv>
    );
};
