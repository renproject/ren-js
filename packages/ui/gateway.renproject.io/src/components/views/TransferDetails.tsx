import { Asset, BurnAndReleaseEvent, LockAndMintEvent } from "@renproject/interfaces";
import { parseRenContract } from "@renproject/utils";
import React, { useEffect, useState } from "react";
import styled from "styled-components";

import infoIcon from "../../scss/images/info.svg";
import { getURL } from "../../state/transferContainer";
import { Tooltip } from "../views/tooltip/Tooltip";

interface Props {
    transfer: LockAndMintEvent | BurnAndReleaseEvent;
}

const TransferDetailsOuter = styled.div`
    overflow: -moz-scrollbars-none;
    scrollbar-width: none;

    &::-webkit-scrollbar {
        /* remove scrollbar space */
        display: none;
        width: 0px;
        height: 0px;
    }

    height: 100px;
    width: 100vw;
    padding: 20px 30px;
    padding-top: 35px;

    font-weight: 500;
    font-size: 12px;
    line-height: 14px;
    color: #707575;

    box-shadow: inset 0px 1px 6px rgba(0, 0, 0, 0.1);
`;

const TransferDetailsRow = styled.div`
    display: flex;
    flex-flow: row;
    justify-content: space-between;
    padding: 4px 0;
`;

const TransferDetailsLeft = styled.div`
`;

const TransferDetailsRight = styled.div`
    text-align: right;
`;

export const TransferDetails: React.FC<Props> = ({ transfer }) => {

    const [title, setTitle] = useState("Unable to load integrator details");
    const url = getURL();

    useEffect(() => {
        try {
            setTitle((new URL(url)).hostname);
        } catch (error) {
            console.error(error);
        }
    }, [url]);

    const token = transfer.transferParams.sendToken;
    const asset: Asset | "" = React.useMemo(() => !token ? "" :
        token === Asset.BTC || token === Asset.ZEC || token === Asset.BCH ? (token as Asset) :
            parseRenContract(token).asset, [token]);

    return <TransferDetailsOuter>
        <TransferDetailsRow>
            <TransferDetailsLeft>Integrator <Tooltip align="right" width={300} contents={"To avoid loss of funds, verify the Integrator URL and only interact with integrators that you trust."}><img alt={`Tooltip: ${url}`} src={infoIcon} /></Tooltip></TransferDetailsLeft>
            <TransferDetailsRight>
                {url ? <img alt="" role="presentation" src={`https://s2.googleusercontent.com/s2/favicons?domain_url=${url}`} /> : null}{" "}{title}{" "}
                {url ? <Tooltip align="left" width={300} contents={url}><img alt={`Tooltip: ${url}`} src={infoIcon} /></Tooltip> : null}
            </TransferDetailsRight>
        </TransferDetailsRow>
        <TransferDetailsRow>
            <TransferDetailsLeft>RenVM Network Fees <Tooltip align="right" width={300} contents={<>A 10 BPS (0.1%) fee is applied per mint or release and is distributed to all active Darknodes. There is also a 16K {asset === Asset.ZEC ? "Zats" : "Sats"} fee for paying blockchain miners.</>}><img alt={`Tooltip: ${url}`} src={infoIcon} /></Tooltip></TransferDetailsLeft>
            <TransferDetailsRight>
                0.1% + 0.00016 {asset.toUpperCase()}
            </TransferDetailsRight>
        </TransferDetailsRow>
    </TransferDetailsOuter>;
};
