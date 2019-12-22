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

const center = (width: number) => css`
  margin-left: -${width / 2}px;
  &::after {
    left: 50%;
  }
`;

const left = (width: number) => css`
  margin-left: -${width * 0.9}px;
  &::after {
    left: 90%;
  }
`;

const right = (width: number) => css`
  margin-left: -${width * 0.1}px;
  &::after {
    left: 10%;
  }
`;

export const Tooltip: React.FC<{
    contents?: React.ReactNode;
    width?: number;
    direction?: string;
    align?: string;
}> = props => {
    const color = "#333";
    const width = props.width ? props.width : 100;
    const TooltipChild = styled.div`
        text-align: center;
        visibility: hidden;
        background-color: ${color};
        color: white;
        padding: 10px;
        border-radius: 4px;
        position: absolute;
        left: 50%;
        width: ${width}px;
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
        ${props.align === "left" ? left(width) : props.align === "right" ? right(width) : center(width)}
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
