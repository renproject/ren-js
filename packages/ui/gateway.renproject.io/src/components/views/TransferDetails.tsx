import * as React from "react";

import { ShiftInEvent, ShiftOutEvent } from "@renproject/interfaces";
import styled from "styled-components";

import infoIcon from "../../images/icons/info.svg";
import { getURL } from "../controllers/Storage";
import { Tooltip } from "../views/tooltip/Tooltip";

const ParentContainer = styled.div`
            display: flex;
            align-content: center;
            align-items: center;
            `;

const ParentInfo = styled.span`
            font-size: 1.8rem;
            margin: 0 5px;
            & > img {
                margin: 0 5px;
            }
                        .address {
                font-size: 1.4rem;
            }
            `;

export const TransferDetails: React.StatelessComponent<{
    shift: ShiftInEvent | ShiftOutEvent,
}> = ({ shift }) => {

    // const title = window.parent.document.title;
    const url = getURL();

    const urlDomain = (data: string) => {
        const a = document.createElement("a");
        a.href = data;
        return a.hostname;
    };

    const title = urlDomain(url);

    return <div className="transfer-details">
        <div className="transfer-details--row">
            <div className="transfer-details--left">Integrator <Tooltip align="right" width={300} contents={"To avoid loss of funds, verify the Integrator URL and only interact with integrators that you trust."}><img alt={`Tooltip: ${url}`} src={infoIcon} /></Tooltip></div>
            <div className="transfer-details--right">
                <img alt="" role="presentation" src={`https://s2.googleusercontent.com/s2/favicons?domain_url=${url}`} />{" "}{title}{" "}
                <Tooltip align="left" width={300} contents={<pre>{url}</pre>}><img alt={`Tooltip: ${url}`} src={infoIcon} /></Tooltip>
            </div>
        </div>
        <div className="transfer-details--row">
            <div className="transfer-details--left">RenVM Network Fees <Tooltip align="right" width={300} contents={"Fees charged by RenVM to cover transaction and operational fees."}><img alt={`Tooltip: ${url}`} src={infoIcon} /></Tooltip></div>
            <div className="transfer-details--right">
                0.1%
            </div>
        </div>
    </div>;
};
