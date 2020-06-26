import * as React from "react";

import { TooltipChildStyle, TooltipContainerStyle } from "./TooltipStyles";

export const Tooltip: React.FC<{
  contents?: React.ReactNode;
  width?: number;
  direction?: "bottom" | "top";
  align?: "left" | "right";
  className?: string;
}> = ({ contents, width, direction, align, className, children }) => {
  const child = <TooltipChildStyle width={width} direction={direction} align={align}>
    {contents}
  </TooltipChildStyle>;

  return <TooltipContainerStyle className={className} child={child}>
    {child}
    {children}
  </TooltipContainerStyle>;
};
