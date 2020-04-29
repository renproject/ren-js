import * as React from "react";

import { ReactComponent as Info } from "./info.svg";
import "./styles.scss";
import { ReactComponent as Warning } from "./warning.svg";

export enum LabelLevel {
    Info = "info",
    Warning = "warning"
}

interface Props extends React.DetailedHTMLProps<React.HTMLAttributes<HTMLDivElement>, HTMLDivElement> {
    level?: LabelLevel;
    children?: React.ReactNode;
}

/**
 * InfoLabel is a visual component for displaying an information message for
 * another component
 */
export const InfoLabel = ({ level, children, className, ...props }: Props) =>
    <div {...props} className={[`label`, className].join(" ")}>
        {level === LabelLevel.Warning ? <Warning className="label--icon" /> : <Info className="label--icon" />}
        <div className="label--message">{children ? children : ""}</div>
    </div>;
