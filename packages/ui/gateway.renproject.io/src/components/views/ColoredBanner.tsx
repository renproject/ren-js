import * as React from "react";

import { RenContract } from "@renproject/interfaces";
import { parseRenContract } from "@renproject/utils";

interface Props {
    token: RenContract | "BTC" | "ZEC" | "BCH" | null;
}

export const ColoredBanner: React.FunctionComponent<Props> = ({ token }) => {

    const asset = React.useMemo(() => token === null ? "null" :
        token === "BTC" || token === "ZEC" || token === "BCH" ? token :
            parseRenContract(token).asset, [token]);

    return <div className={`colored-banner colored-banner--${asset.toLowerCase()}`} />;
};
