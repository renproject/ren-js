import * as React from "react";

import { Currency } from "../../currencyIcon/CurrencyIcon";
import { CurrencyIcon, SelectMarket } from "../../lib";
import { TokenValueInput } from "../TokenValueInput";
import "./1.scss";
import arrow from "./arrow.svg";

type Token = string;
type MarketPair = string;

export const Tokens = new Map<Token, { symbol: string; name: string }>()
    .set("DAI", { symbol: "DAI", name: "Dai" })
    .set("BTC", { symbol: "BTC", name: "Bitcoin" })
    .set("ETH", { symbol: "ETH", name: "Ethereum" })
    .set("REN", { symbol: "REN", name: "Ren" })
    .set("TUSD", { symbol: "TUSD", name: "TrueUSD" })
    .set("WBTC", { symbol: "WBTC", name: "Wrapped Bitcoin" });

export const MarketPairs = new Map<
    MarketPair,
    { symbol: string; quote: string; base: string }
>()
    .set("BTC/DAI", { symbol: "BTC/DAI", quote: "DAI", base: "BTC" })
    .set("ETH/DAI", { symbol: "ETH/DAI", quote: "DAI", base: "ETH" })
    .set("ETH/BTC", { symbol: "ETH/BTC", quote: "BTC", base: "ETH" })
    .set("WBTC/BTC", { symbol: "WBTC/BTC", quote: "BTC", base: "WBTC" });

export const getMarket = (
    left: Token,
    right: Token,
): MarketPair | undefined => {
    const opt1 = `${left}/${right}`;
    const opt2 = `${right}/${left}`;

    if (MarketPairs.has(opt1)) {
        return opt1;
    }

    if (MarketPairs.has(opt2)) {
        return opt2;
    }

    return undefined;
};

export default () => {
    const [top, setTop] = React.useState("BTC");
    const [bottom, setBottom] = React.useState("DAI");
    const [value, setValue] = React.useState("0");

    const toggleSide = () => {
        setTop(bottom);
        setBottom(top);
    };

    const toggle = (
        <div className="order--tabs">
            <span role="button" onClick={toggleSide}>
                <img alt="Swap side" role="button" src={arrow} />
            </span>
        </div>
    );

    const topSelect = (
        <SelectMarket
            top
            thisToken={top}
            otherToken={bottom}
            allTokens={Tokens}
            key={"top"}
            onMarketChange={setTop}
            getMarket={getMarket}
        />
    );
    const bottomSelect = (
        <SelectMarket
            bottom
            thisToken={bottom}
            otherToken={top}
            allTokens={Tokens}
            key={"bottom"}
            onMarketChange={setBottom}
            getMarket={getMarket}
        />
    );

    const first = (
        <TokenValueInput
            title={"Top title"}
            value={value}
            subtext={
                <>
                    <CurrencyIcon currency={Currency.USD} />
                    {value}
                </>
            }
            hint={null}
            error={false}
            onValueChange={setValue}
        >
            {topSelect}
        </TokenValueInput>
    );

    const second = (
        <TokenValueInput
            title={"Bottom title"}
            value={value.split("").reverse().join("")}
            subtext={"Reversed value"}
            hint={"This is the same but reversed"}
            error={false}
            onValueChange={null}
            className="order-inputs--second"
        >
            {bottomSelect}
        </TokenValueInput>
    );

    return (
        <div className="order--wrapper">
            {first}
            {toggle}
            {second}
        </div>
    );
};
