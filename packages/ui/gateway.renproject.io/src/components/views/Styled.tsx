import { Loading } from "@renproject/react-components";
import { lighten } from "polished";
import styled from "styled-components";

export const TransparentLoading = styled(Loading)`
    position: absolute;
    margin-left: 20px;
    margin-top: 3px;
    display: inline-block;
    border-color: rgba(255, 255, 255, 0.5) transparent rgba(255, 255, 255, 0.5)
        transparent;
`;

export const TransparentButton = styled.button`
    position: relative;
    opacity: 1;
    &:disabled {
        color: rgba(255, 255, 255, 1);
        background-color: ${(p) => lighten(0.3, p.theme.primaryColor)};
        opacity: 1 !important;
    }
`;
