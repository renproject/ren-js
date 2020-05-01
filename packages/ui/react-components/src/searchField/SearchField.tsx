import * as React from "react";

import { ReactComponent as Magnify } from "./magnify.svg";
import "./styles.scss";

interface Props extends React.DetailedHTMLProps<React.HTMLAttributes<HTMLDivElement>, HTMLDivElement> {
    value: string;
    placeholder: string;
    autoFocus?: boolean;
    onSearchChange(input: string): void;
}

export const SearchField = ({ value, placeholder, autoFocus, onSearchChange, className, ...props }: Props) => {

    const handleInput = React.useCallback((event: React.FormEvent<HTMLInputElement>): void => {
        const element = (event.target as HTMLInputElement);
        onSearchChange(element.value);
    }, [onSearchChange]);

    return <div {...props} className={["search-bar", className ? className : ""].join(" ")}>
        <Magnify className="search-bar--icon" />
        <input
            type="text"

            placeholder={placeholder}
            onChange={handleInput}
            value={value}
            autoFocus={autoFocus}
        />
    </div>;
};

export const escapeRegExp = (text: string) => {
    return text.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, "\\$&");
};
