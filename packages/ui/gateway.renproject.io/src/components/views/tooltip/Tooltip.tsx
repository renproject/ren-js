import * as React from "react";

import { TooltipChildStyle, TooltipContainerStyle } from "./TooltipStyles";

export const Tooltip: React.FC<{
  contents?: React.ReactNode;
  width?: number;
  direction?: string;
  align?: string;
}> = ({ contents, width, direction, align, children }) => {
  const child = <TooltipChildStyle width={width} direction={direction} align={align}>
    {contents}
  </TooltipChildStyle>;

  return <TooltipContainerStyle child={child}>
    {child}
    {children}
  </TooltipContainerStyle>;
};
