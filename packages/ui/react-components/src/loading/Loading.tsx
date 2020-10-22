import * as React from "react";

import "./styles.scss";

/**
 * Loading is a visual component that renders a spinning animation
 */
export const Loading = ({ alt, className, ...props }: Props): JSX.Element => (
    <div
        {...props}
        className={[
            "loading",
            "lds-dual-ring",
            alt ? "alt" : "",
            className,
        ].join(" ")}
    />
);

// tslint:disable: react-unused-props-and-state
interface Props
    extends React.DetailedHTMLProps<
        React.HTMLAttributes<HTMLDivElement>,
        HTMLDivElement
    > {
    alt?: boolean;
}
