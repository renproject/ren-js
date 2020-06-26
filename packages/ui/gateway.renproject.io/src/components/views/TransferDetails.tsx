import * as React from "react";

import { Asset, BurnAndReleaseEvent, LockAndMintEvent } from "@renproject/interfaces";
import { parseRenContract } from "@renproject/utils";

import infoIcon from "../../scss/images/info.svg";
import { getURL } from "../../state/transferContainer";
import { Tooltip } from "../views/tooltip/Tooltip";

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
    const asset: Asset | "" = React.useMemo(() => !token ? "" :
        token === "BTC" || token === "ZEC" || token === "BCH" ? (token as Asset) :
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
            <div className="transfer-details--left">RenVM Network Fees <Tooltip align="right" width={300} contents={<>A 10 BPS (0.1%) fee is applied per mint or release and is distributed to all active Darknodes. There is also a 35K {asset === Asset.ZEC ? "Zats" : "Sats"} fee for paying blockchain miners.</>}><img alt={`Tooltip: ${url}`} src={infoIcon} /></Tooltip></div>
            <div className="transfer-details--right">
                0.1% + 0.00035 {asset.toUpperCase()}
            </div>
        </div>
    </div>;
};
