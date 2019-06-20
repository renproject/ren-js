import * as React from "react";

import { titleCase } from "change-case";

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
                <h2>{titleCase(networkData.name)}</h2>
                {format(networkData)}
            </div>
        );
    }
}

export default Network;
