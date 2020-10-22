import * as React from "react";

import "./styles.scss";

/**
 * Header is a visual component providing page branding and navigation.
 */
export const Header = ({ logo, menu, className, ...props }: Props) => (
    <div {...props} className={["header", className].join(" ")}>
        <div className="container">
            <div className="header--logo">{logo}</div>
            <div className="header--menu">{menu}</div>
        </div>
    </div>
);

// tslint:disable: react-unused-props-and-state
interface Props
    extends React.DetailedHTMLProps<
        React.HTMLAttributes<HTMLDivElement>,
        HTMLDivElement
    > {
    logo: React.ReactNode;
    menu: React.ReactNode[];
}
