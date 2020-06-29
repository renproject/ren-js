import React from "react";
import styled from "styled-components";

const PopupOuter = styled.div`
    position: absolute;
    height: 100vh;
    width: 100vw;
    top: 0;
    left: 0;
    z-index: 15;
`;

const PopupOverlay = styled.div`
    height: 100vh;
    width: 100vw;

    background: #00000055;
`;

const PopupInner = styled.div`
    /* @extend .centered; */
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);

    background: white;
    box-shadow: 0 0 20px rgba(0, 0, 0, 0.3);
`;

interface Props extends React.DetailedHTMLProps<React.HTMLAttributes<HTMLDivElement>, HTMLDivElement> {
    closePopup: () => void;
}

export const Popup: React.FC<Props> = ({ closePopup, children, className, ref, ...props }) => (
    <PopupOuter ref={ref as ((instance: HTMLDivElement | null) => void) | React.RefObject<HTMLDivElement> | null | undefined} {...props}>
        <PopupOverlay role="none" onClick={closePopup} />
        <PopupInner className={className}>
            {children}
        </PopupInner>
    </PopupOuter>
);
