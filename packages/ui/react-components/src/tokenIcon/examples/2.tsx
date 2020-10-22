import * as React from "react";

import { TokenIcon } from "../TokenIcon";

export default () => (
    <div style={{ background: "#333", color: "white", padding: "10px" }}>
        <p>
            <TokenIcon token={"BTC"} white />
            BTC
        </p>
        <p>
            <TokenIcon token={"BCH"} white />
            BCH
        </p>
        <p>
            <TokenIcon token={"DAI"} white />
            DAI
        </p>
        <p>
            <TokenIcon token={"DGX"} white />
            DGX
        </p>
        <p>
            <TokenIcon token={"ETH"} white />
            ETH
        </p>
        <p>
            <TokenIcon token={"OMG"} white />
            OMG
        </p>
        <p>
            <TokenIcon token={"REN"} white />
            REN
        </p>
        <p>
            <TokenIcon token={"TUSD"} white />
            TUSD
        </p>
        <p>
            <TokenIcon token={"WBTC"} white />
            WBTC
        </p>
        <p>
            <TokenIcon token={"ZEC"} white />
            ZEC
        </p>
        <p>
            <TokenIcon token={"ZRX"} white />
            ZRX
        </p>

        <p>
            <TokenIcon token={"GUSD"} white />
            GUSD
        </p>
        <p>
            <TokenIcon token={"PAX"} white />
            PAX
        </p>
        <p>
            <TokenIcon token={"USDT"} white />
            USDT
        </p>
    </div>
);
