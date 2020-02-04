import * as React from "react";

import styled from "styled-components";

import { TooltipChildStyle, TooltipContainerStyle } from "./TooltipStyles";

export const Tooltip: React.FC<{
  contents?: React.ReactNode;
  width?: number;
  direction?: string;
  align?: string;
}> = ({ contents, width, direction, align, children }) => {
  const TooltipChild = styled.span`${TooltipChildStyle(width, direction, align)}`;
  const TooltipContainer = styled.span`${TooltipContainerStyle(TooltipChild)}`;
  return <TooltipContainer>
    <TooltipChild>
      {contents}
    </TooltipChild>
    {children}
  </TooltipContainer>;
};
