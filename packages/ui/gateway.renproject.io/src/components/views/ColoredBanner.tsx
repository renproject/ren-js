import { Asset, RenContract } from "@renproject/interfaces";
import { parseRenContract } from "@renproject/utils";
import React from "react";
import styled from "styled-components";

interface Props {
    token: RenContract | "BTC" | "ZEC" | "BCH" | null;
}

export const ColoredBanner = React.memo(styled.div<Props>`
    height: 6px;
    width: 100%;
    background-color: ${props => {
        const { token } = props;
        const asset = React.useMemo(() => token === null ? "null" :
            token === "BTC" || token === "ZEC" || token === "BCH" ? token :
                parseRenContract(token).asset, [token]);
        switch (asset) {
            case Asset.BTC: return "#F2A900";
            case Asset.ZEC: return "#FABB00";
            case Asset.BCH: return "#44C43E";
            default: return "initial";
        }
    }}
`);
