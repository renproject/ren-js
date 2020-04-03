import * as React from "react";

import { Blocky } from "../Blocky";

function randomAddress() {
    var text = "0x";
    var possible = "ABCDEFabcdef0123456789";

    for (var i = 0; i < 40; i++)
        text += possible.charAt(Math.floor(Math.random() * possible.length));

    return text;
}

const range = (n: number) => Array.from(Array(n).keys())

export default () => {

    return <div style={{ display: "flex", flexWrap: "wrap" }}>
        {range(24).map((_, i) =>
            <Blocky key={i} address={randomAddress()} />
        )}
    </div>;
};
