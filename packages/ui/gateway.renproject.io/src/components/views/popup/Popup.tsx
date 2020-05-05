import classNames from "classnames";
import React from "react";

interface Props extends React.DetailedHTMLProps<React.HTMLAttributes<HTMLDivElement>, HTMLDivElement> {
    closePopup: () => void;
}

export const Popup: React.FunctionComponent<Props> = ({ closePopup, children, className, ...props }) => {
    return <div {...props} className="popup">
        <div role="none" className="popup-overlay" onClick={closePopup} />
        <div className={classNames("popup-inner", className)}>
            {children}
        </div>
    </div>;
};
