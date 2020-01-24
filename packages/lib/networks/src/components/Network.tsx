import * as React from "react";

import { capitalCase } from "change-case";

import { FormatFN } from "../lib/layouts";
import { NetworkData } from "../lib/networks";

interface INetworkProps {
    networkData: NetworkData;
    format: FormatFN;
}

class Network extends React.Component<INetworkProps> {
    public render() {
        const { format, networkData } = this.props;
        return (
            <div className="network">
                <h2>{capitalCase(networkData.name)}</h2>
                {format(networkData)}
            </div>
        );
    }
}

export default Network;
