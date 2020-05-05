import * as React from "react";

import { className } from "../../lib/className";

export const Container: React.StatelessComponent<{
    mini: boolean;
}> = ({ mini, children }) => {
    return <div className={className("gateway-container", mini ? "container--paused" : "")}>
        {children}
    </div>;
};
