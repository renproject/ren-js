import * as React from "react";

import { lighten } from "polished";
import styled from "styled-components";

const OuterDiv = styled.div`
    position: relative;
    border: 1px solid #dbe0e8;
    box-shadow: 0px 1px 2px rgba(0, 27, 58, 0.05);
    border-radius: 6px;
    transition: all 500ms;
    `;

// tslint:disable-next-line: no-any
export const LabelledInput = (props: any) => {
    const { inputLabel, children, width, ...rest } = props;
    const setWidth = width ? width : 210;
    const StyledInput = styled.input`
    color: ${p => lighten(0.1, p.theme.primaryColor)} !important;
    font-size: 14px !important;
    font-weight: 400 !important;
    `;

    const w = 105; // + (210 - setWidth) / 2;
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

    return (
        <OuterDiv>
            <StyledInput type="text" {...rest} />
            <DepositLabel>{inputLabel}</DepositLabel>
            {props.children}
        </OuterDiv>
    );
};
