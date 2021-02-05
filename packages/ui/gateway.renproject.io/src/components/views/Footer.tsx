import React from "react";
import styled from "styled-components";

import infoIcon from "../../scss/images/info.svg";
import smallLogo from "../../scss/images/logo-small-grey.png";
import { ExternalLink } from "./ExternalLink";
import { Tooltip } from "./tooltip/Tooltip";

const FooterContainer = styled.div`
    display: flex;
    align-items: center;
    justify-content: space-between;
    border-top: 1px solid #ccc;
    position: fixed;
    bottom:0;
    height: 30px;
    width: 100%;
    font-size: 1.2rem;
    color: rgba(0, 0, 0, 0.4);
    padding: 0 30px;
    z-index: 100;
    &::before {
        content: '';
    }
    `;
const RenVMLink = styled.a`
    text-decoration: underline;
    `;

export const Footer: React.FC = () => {
    const bridgeInfo = `Your tokens will be bridged to Ethereum in a completely trustless and decentralized way.`;

    return (
        <FooterContainer>
            <div>
                <img alt="" role="presentation" src={smallLogo} style={{ width: "10px", marginRight: "5px" }} /><span>Powered by <RenVMLink href="https://renproject.io/renvm" target="_blank" rel="noopener noreferrer">RenVM</RenVMLink></span>
            </div>
            <div>
                <Tooltip align="left" width={200} contents={<span>{bridgeInfo} Read more about RenVM and sMPC <ExternalLink href="https://renproject.io/renvm">here</ExternalLink>.</span>}><img alt={bridgeInfo} src={infoIcon} /></Tooltip>
            </div>
        </FooterContainer>
    );
};
