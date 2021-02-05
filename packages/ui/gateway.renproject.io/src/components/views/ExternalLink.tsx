import React from "react";

interface Props extends React.AnchorHTMLAttributes<HTMLAnchorElement> {
}

export const ExternalLink = ({ children, ...props }: Props) => (
    // tslint:disable-next-line: react-a11y-anchors
    <a
        {...props}
        target="_blank"
        rel="noopener noreferrer"
    >
        {children}
    </a>
);
