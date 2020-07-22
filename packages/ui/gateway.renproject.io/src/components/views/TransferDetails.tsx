import * as React from "react";

import {
    Asset, BurnAndReleaseEvent, EventType, LockAndMintEvent, UnmarshalledFees,
} from "@renproject/interfaces";
import { parseRenContract } from "@renproject/utils";
import BigNumber from "bignumber.js";

import infoIcon from "../../images/icons/info.svg";
import { getURL } from "../controllers/Storage";
import { Tooltip } from "../views/tooltip/Tooltip";

export const TransferDetails: React.StatelessComponent<{
    transfer: LockAndMintEvent | BurnAndReleaseEvent,
    fees: UnmarshalledFees | null,
}> = ({ transfer, fees }) => {

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

    let feeString: React.ReactNode = "";
    try {
        const transferFee = fees && fees[asset.toLowerCase() as "btc" | "bch" | "zec"][transfer.eventType === EventType.LockAndMint ? "lock" : "release"];
        const darknodeFee = fees && fees[asset.toLowerCase() as "btc" | "bch" | "zec"].ethereum[transfer.eventType === EventType.LockAndMint ? "mint" : "burn"];
        feeString = <>{darknodeFee ? (darknodeFee / 10000 * 100) : "..."}% + {transferFee ? (new BigNumber(transferFee)).div(new BigNumber(10).exponentiatedBy(8)).toFixed() : "..."} {asset.toUpperCase()}</>;
    } catch (error) {
        console.error(error);
    }

    return <div className="transfer-details">
        <div className="transfer-details--row">
            <div className="transfer-details--left">Integrator <Tooltip align="right" width={300} contents={"To avoid loss of funds, verify the Integrator URL and only interact with integrators that you trust."}><img alt={`Tooltip: ${url}`} src={infoIcon} /></Tooltip></div>
            <div className="transfer-details--right">
                <img alt="" role="presentation" src={`https://s2.googleusercontent.com/s2/favicons?domain_url=${url}`} />{" "}{title}{" "}
                <Tooltip align="left" width={300} contents={<pre>{url}</pre>}><img alt={`Tooltip: ${url}`} src={infoIcon} /></Tooltip>
            </div>
        </div>
        <div className="transfer-details--row">
            <div className="transfer-details--left">RenVM Network Fees <Tooltip align="right" width={300} contents={<>A 10 BPS (0.1%) fee is applied per mint or release and is distributed to all active Darknodes. There is also a 16K {asset === Asset.ZEC ? "Zats" : "Sats"} fee for paying blockchain miners.</>}><img alt={`Tooltip: ${url}`} src={infoIcon} /></Tooltip></div>
            <div className="transfer-details--right">
                {feeString}
            </div>
        </div>
    </div>;
};
