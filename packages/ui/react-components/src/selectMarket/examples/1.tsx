import * as React from "react";

import { SelectMarket } from "../SelectMarket";

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
  right: Token
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

  return <div className="select-market--example">
    <SelectMarket
      top
      thisToken={top}
      otherToken={bottom}
      allTokens={Tokens}
      key={"top"}
      onMarketChange={setTop}
      getMarket={getMarket}
    />
    <SelectMarket
      bottom
      thisToken={bottom}
      otherToken={top}
      allTokens={Tokens}
      key={"bottom"}
      onMarketChange={setBottom}
      getMarket={getMarket}
    />
  </div>;
}
