import { lighten } from "polished";
import React from "react";
import styled from "styled-components";

import { ScanningDot } from "./ScanningDot";

const OuterDiv = styled.div`
    position: relative;
    border: 1px solid #dbe0e8;
    box-shadow: 0px 1px 2px rgba(0, 27, 58, 0.05);
    border-radius: 6px;
    transition: all 500ms;
    background: white;
    `;

// tslint:disable-next-line: no-any
export const LabelledDiv = (props: any) => {
    const { inputLabel, children, width, loading, ...rest } = props;
    const setWidth = width ? width : 210;
    const StyledInputFlex = styled.div`
    display: flex;
    align-items: center;
    overflow-x: hidden;
    height: 40px;
    `;
    const StyledInput = styled.div`
    color: ${p => lighten(0.1, p.theme.primaryColor)} !important;
    font-size: 14px;
    max-width: 100%;
    text-overflow: ellipsis;
    padding: 0 20px;
    overflow:hidden;
    white-space:nowrap;
    margin-top: 2px;
    `;

    const DepositLabel = styled.label`
    position: absolute;
    top: 0;
    width: ${setWidth}px;
    text-align: center;
    margin-left: calc(calc(100% - ${setWidth}px) / 2);
    font-size: 1.4rem;
    color: ${p => p.theme.lightGrey};
    background-color: white;
    margin-top: -10px;
    `;

    return (
        <OuterDiv>
            <StyledInputFlex>
                <StyledInput {...rest}>{props.children}</StyledInput>
                {loading ? <ScanningDot /> : <></>}
            </StyledInputFlex>
            <DepositLabel>{inputLabel}</DepositLabel>
        </OuterDiv>
    );
};

// tslint:disable-next-line: no-any
export const LabelledInput = (props: any) => {
    const { inputLabel, children, width, ...rest } = props;
    const setWidth = width ? width : 210;
    const StyledInput = styled.input`
    color: ${p => lighten(0.1, p.theme.primaryColor)} !important;
    font-size: 14px !important;
    font-weight: 400 !important;
    `;

    const DepositLabel = styled.label`
    position: absolute;
    top: 0;
    width: ${setWidth}px;
    text-align: center;
    margin-left: calc(calc(100% - ${setWidth}px) / 2);
    font-size: 1.4rem;
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
