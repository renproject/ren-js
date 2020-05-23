import * as React from "react";

import { BurnAndReleaseEvent, LockAndMintEvent } from "@renproject/interfaces";
import { parseRenContract } from "@renproject/utils";

import infoIcon from "../../images/icons/info.svg";
import { getURL } from "../controllers/Storage";
import { Tooltip } from "../views/tooltip/Tooltip";
import { ExternalLink } from "./ExternalLink";

export const TransferDetails: React.StatelessComponent<{
    transfer: LockAndMintEvent | BurnAndReleaseEvent,
}> = ({ transfer }) => {

    // const title = window.parent.document.title;
    const url = getURL();

    const urlDomain = (data: string) => {
        const a = document.createElement("a");
        a.href = data;
        return a.hostname;
    };

    const title = urlDomain(url);

    const token = transfer.transferParams.sendToken;
    const asset = React.useMemo(() => !token ? "null" :
        token === "BTC" || token === "ZEC" || token === "BCH" ? token :
            parseRenContract(token).asset, [token]);

    return <div className="transfer-details">
        <div className="transfer-details--row">
            <div className="transfer-details--left">Integrator <Tooltip align="right" width={300} contents={"To avoid loss of funds, verify the Integrator URL and only interact with integrators that you trust."}><img alt={`Tooltip: ${url}`} src={infoIcon} /></Tooltip></div>
            <div className="transfer-details--right">
                <img alt="" role="presentation" src={`https://s2.googleusercontent.com/s2/favicons?domain_url=${url}`} />{" "}{title}{" "}
                <Tooltip align="left" width={300} contents={<pre>{url}</pre>}><img alt={`Tooltip: ${url}`} src={infoIcon} /></Tooltip>
            </div>
        </div>
        <div className="transfer-details--row">
            <div className="transfer-details--left">RenVM Network Fees <Tooltip align="right" width={300} contents={<>Your assets will be bridged to Ethereum in a completely trustless and decentralized way. Read more about RenVM and sMPC <ExternalLink href="https://renproject.io/renvm">here</ExternalLink>.</>}><img alt={`Tooltip: ${url}`} src={infoIcon} /></Tooltip></div>
            <div className="transfer-details--right">
                0.1% + 0.00005 {asset.toUpperCase()}
            </div>
        </div>
    </div>;
};
