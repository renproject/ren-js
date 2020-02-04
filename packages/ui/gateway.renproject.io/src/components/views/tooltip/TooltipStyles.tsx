import { css, StyledComponent } from "styled-components";

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

export const TooltipChildStyle = (widthIn?: number, direction?: string, align?: string) => {

  const color = "#333";
  const width = widthIn ? widthIn : 100;

  return css`
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
        z-index: 100;
        &::after {
            content: "";
            position: absolute;
            margin-left: -5px;
            border-width: 5px;
            border-style: solid;
        }
        ${direction === "bottom" ? onBottom(color) : onTop(color)}
        ${align === "left" ? left(width) : align === "right" ? right(width) : center(width)}
    `;
};

// tslint:disable-next-line: no-any
export const TooltipContainerStyle = (child: StyledComponent<any, any>) => {
  return css`
    position: relative;
    cursor: pointer;
        &: hover ${child} {
        visibility: visible;
        opacity: 1;
    }
    `;
};
