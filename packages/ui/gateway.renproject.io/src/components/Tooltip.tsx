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

const center = css`
  margin-left: -50px;
  &::after {
    left: 50%;
  }
`;

const left = css`
  margin-left: -90px;
  &::after {
    left: 90%;
  }
`;

const right = css`
  margin-left: -10px;
  &::after {
    left: 10%;
  }
`;

export const Tooltip: React.FC<{
    contents?: React.ReactNode;
    direction?: string;
    align?: string;
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
        opacity: 0;
        transition: all 0.2s;
        &::after {
            content: "";
            position: absolute;
            margin-left: -5px;
            border-width: 5px;
            border-style: solid;
        }
        ${props.direction === "bottom" ? onBottom(color) : onTop(color)}
        ${props.align === "left" ? left : props.align === "right" ? right : center}
    `;
    const TooltipContainer = styled.div`
        display: block;
        position: relative;
        cursor: pointer;
        &:hover ${TooltipChild} {
            visibility: visible;
            opacity: 1;
        }
    `;
    return <TooltipContainer><TooltipChild>{props.contents}</TooltipChild>{props.children}</TooltipContainer>;
};
