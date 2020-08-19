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

export const TooltipChildStyle = styled.span<{ width?: number, align?: string, direction?: string }>`
        overflow: scroll;
        overflow: -moz-scrollbars-none;
        scrollbar-width: none;

        &::-webkit-scrollbar {
            /* remove scrollbar space */
            display: none;
            width: 0px;
            height: 0px;
        }

        text-align: center;
        visibility: hidden;
        background-color: #333;
        color: white;
        padding: 10px;
        border-radius: 4px;
        position: absolute;
        left: 50%;
        width: ${props => props.width || 100}px;
        opacity: 0;
        transition: all 0.2s;
        z-index: 100;
        &::after {
            content: "";
            position: absolute;
            margin-left: -5px;
            border-width: 5px;
            border-style: solid;
        }
        ${props => props.direction === "bottom" ? onBottom("#333") : onTop("#333")}
        ${props => props.align === "left" ? left(props.width || 100) : props.align === "right" ? right(props.width || 100) : center(props.width || 100)}
    `;

// tslint:disable-next-line: no-any
export const TooltipContainerStyle = styled.span<{ child: JSX.Element }>`
    position: relative;
    /* cursor: pointer; */
    &:hover ${TooltipChildStyle} {
        visibility: visible;
        opacity: 1;
    }
`;
