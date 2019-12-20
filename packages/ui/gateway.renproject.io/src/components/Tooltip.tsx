import * as React from "react";
import styled, { css } from "styled-components";

const onTop = (color: string) => css`
  bottom: 110%;
  &::after {
      top: 100%;
    border-color: ${color} transparent transparent transparent;
  };
`;

const onBottom = (color: string) => css`
  top: 110%;
  &::after {
      bottom: 100%;
    border-color: transparent transparent ${color} transparent;
  };
`;

export const Tooltip: React.FC<{
    contents?: React.ReactNode;
    direction?: string;
}> = props => {
    const color = "#333";
    const TooltipChild = styled.div`
        text-align: center;
        visibility: hidden;
        background-color: ${color};
        color: white;
        padding: 10px;
        border-radius: 4px;
        position: absolute;
        left: 50%;
        width: 100px;
        margin-left: -50px;
        opacity: 0;
        transition: all 0.2s;
        &::after {
            content: "";
            position: absolute;
            left: 50%;
            margin-left: -5px;
            border-width: 5px;
            border-style: solid;
        }
        ${props.direction === "bottom" ? onBottom(color) : onTop(color)}
    `;
    const TooltipContainer = styled.div`
        display: block;
        position: relative;
        &:hover ${TooltipChild} {
            visibility: visible;
            opacity: 1;
        }
    `;
    return <TooltipContainer><TooltipChild>{props.contents}</TooltipChild>{props.children}</TooltipContainer>;
};
