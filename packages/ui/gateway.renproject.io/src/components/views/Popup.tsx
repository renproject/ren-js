import * as React from "react";

import { className } from "../../lib/className";

export const Popup: React.StatelessComponent<{
    mini: boolean;
}> = ({ mini, children }) => {
    return <div className={className("popup", mini ? "popup--paused" : "")}>
        {children}
    </div>;
};
