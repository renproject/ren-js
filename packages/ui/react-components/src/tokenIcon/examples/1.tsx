import * as React from "react";

import { TokenIcon } from "../TokenIcon";

export default () => (
    <div style={{ padding: "10px" }}>
        <p>
            <TokenIcon token={"BTC"} /> BTC
        </p>
        <p>
            <TokenIcon token={"BCH"} /> BCH
        </p>
        <p>
            <TokenIcon token={"DAI"} /> DAI
        </p>
        <p>
            <TokenIcon token={"DGX"} /> DGX
        </p>
        <p>
            <TokenIcon token={"ETH"} /> ETH
        </p>
        <p>
            <TokenIcon token={"OMG"} /> OMG
        </p>
        <p>
            <TokenIcon token={"REN"} /> REN
        </p>
        <p>
            <TokenIcon token={"TUSD"} /> TUSD
        </p>
        <p>
            <TokenIcon token={"WBTC"} /> WBTC
        </p>
        <p>
            <TokenIcon token={"ZEC"} /> ZEC
        </p>
        <p>
            <TokenIcon token={"ZRX"} /> ZRX
        </p>
    </div>
);
