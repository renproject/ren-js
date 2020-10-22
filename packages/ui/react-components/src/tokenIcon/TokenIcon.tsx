import * as React from "react";

import { ReactComponent as Info } from "../infoLabel/info.svg";
// Color icons
import { ReactComponent as ColorBCH } from "./icons/color/bch.svg";
import { ReactComponent as ColorBTC } from "./icons/color/btc.svg";
import { ReactComponent as ColorDAI } from "./icons/color/dai.svg";
import { ReactComponent as ColorDGX } from "./icons/color/dgx.svg";
import { ReactComponent as ColorETH } from "./icons/color/eth.svg";
import { ReactComponent as ColorOMG } from "./icons/color/omg.svg";
import { ReactComponent as ColorREN } from "./icons/color/ren.svg";
import { ReactComponent as ColorTUSD } from "./icons/color/tusd.svg";
import { ReactComponent as ColorWBTC } from "./icons/color/wbtc.svg";
import { ReactComponent as ColorZEC } from "./icons/color/zec.svg";
import { ReactComponent as ColorZRX } from "./icons/color/zrx.svg";
// White icons
import { ReactComponent as WhiteBCH } from "./icons/white/bch.svg";
import { ReactComponent as WhiteBTC } from "./icons/white/btc.svg";
import { ReactComponent as WhiteDAI } from "./icons/white/dai.svg";
import { ReactComponent as WhiteDGX } from "./icons/white/dgx.svg";
import { ReactComponent as WhiteETH } from "./icons/white/eth.svg";
import { ReactComponent as WhiteGUSD } from "./icons/white/gusd.svg";
import { ReactComponent as WhiteOMG } from "./icons/white/omg.svg";
import { ReactComponent as WhitePAX } from "./icons/white/pax.svg";
import { ReactComponent as WhiteREN } from "./icons/white/ren.svg";
import { ReactComponent as WhiteTUSD } from "./icons/white/tusd.svg";
import { ReactComponent as WhiteUSDT } from "./icons/white/usdt.svg";
import { ReactComponent as WhiteWBTC } from "./icons/white/wbtc.svg";
import { ReactComponent as WhiteZEC } from "./icons/white/zec.svg";
import { ReactComponent as WhiteZRX } from "./icons/white/zrx.svg";
import "./styles.scss";

const icons = {
    color: {
        BTC: ColorBTC,
        BCH: ColorBCH,
        DAI: ColorDAI,
        DGX: ColorDGX,
        ETH: ColorETH,
        OMG: ColorOMG,
        REN: ColorREN,
        TUSD: ColorTUSD,
        WBTC: ColorWBTC,
        ZEC: ColorZEC,
        ZRX: ColorZRX,
    },
    white: {
        BTC: WhiteBTC,
        BCH: WhiteBCH,
        DAI: WhiteDAI,
        DGX: WhiteDGX,
        ETH: WhiteETH,
        OMG: WhiteOMG,
        REN: WhiteREN,
        TUSD: WhiteTUSD,
        WBTC: WhiteWBTC,
        ZEC: WhiteZEC,
        ZRX: WhiteZRX,
        GUSD: WhiteGUSD,
        PAX: WhitePAX,
        USDT: WhiteUSDT,
    },
};

interface Props
    extends React.DetailedHTMLProps<
        React.HTMLAttributes<HTMLImageElement>,
        HTMLImageElement
    > {
    token: string;
    white?: boolean;
}

export const TokenIcon = ({
    token,
    white,
    className,
    ...props
}: Props): JSX.Element =>
    React.createElement(icons[white ? "white" : "color"][token] || Info, {
        ...props,
        className: ["token--icon", className ? className : ""].join(" "),
    });
