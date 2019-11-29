import * as React from "react";

export const Popup: React.StatelessComponent<{
    mini: boolean;
}> = ({ mini, children }) => {
    return <div className={["popup", mini ? "popup--paused" : ""].join(" ")}>
        {children}
    </div>;
    {/* {noOverlay ? null : <div role="none" className="overlay" /*onClick={cancel}/ />} */ }
};
