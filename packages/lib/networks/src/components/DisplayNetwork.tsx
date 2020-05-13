import * as React from "react";

import { capitalCase } from "change-case";

import { FormatFN } from "../lib/layouts";
import { NetworkData } from "../lib/networks";

interface Props {
    networkData: NetworkData;
    format: FormatFN;
}

export const DisplayNetwork = ({ format, networkData }: Props) =>
    <div className="network">
        <h2>{capitalCase(networkData.name)}</h2>
        {format(networkData)}
    </div>;
