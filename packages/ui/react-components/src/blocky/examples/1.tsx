import * as React from "react";

import { Blocky } from "../Blocky";

const randomAddress = () => {
    let text = "0x";
    const possible = "ABCDEFabcdef0123456789";

    for (let i = 0; i < 40; i++)
        // tslint:disable-next-line: insecure-random
        text += possible.charAt(Math.floor(Math.random() * possible.length));

    return text;
};

const range = (n: number) => Array.from(Array(n).keys());

export default () => {
    return (
        <div style={{ display: "flex", flexWrap: "wrap" }}>
            {range(24).map((_, i) => (
                <Blocky key={i} address={randomAddress()} />
            ))}
        </div>
    );
};
