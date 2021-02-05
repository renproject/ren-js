import React from "react";

import { TooltipChildStyle, TooltipContainerStyle } from "./TooltipStyles";

interface Props {
  contents?: React.ReactNode;
  width?: number;
  direction?: "bottom" | "top";
  align?: "left" | "right";
  className?: string;
}

export const Tooltip: React.FC<Props> = ({ contents, width, direction, align, className, children }) => {
  const child = <TooltipChildStyle width={width} direction={direction} align={align}>
    {contents}
  </TooltipChildStyle>;

  return <TooltipContainerStyle className={className} child={child}>
    {child}
    {children}
  </TooltipContainerStyle>;
};
