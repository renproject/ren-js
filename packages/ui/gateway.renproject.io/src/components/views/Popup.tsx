import * as React from "react";

export const Popup: React.StatelessComponent<{
    noOverlay?: boolean;
    whiteX?: boolean;
    cancel?: () => void;
}> = ({ noOverlay, whiteX, cancel, children }) => {
    return <div className="popup">
        {cancel ? <div role="button" className={`popup--x ${whiteX ? "popup--x--white" : ""}`} onClick={cancel} /> : <></>}
        {children}
    </div>
    {/* {noOverlay ? null : <div role="none" className="overlay" /*onClick={cancel}/ />} */ }
};
