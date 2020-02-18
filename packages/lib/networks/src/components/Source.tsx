// import * as qs from "query-string";
import * as React from "react";

// import axios from "axios";
import { OrderedMap } from "immutable";
import { RouteComponentProps, withRouter } from "react-router-dom";

import { NetworkData } from "../lib/networks";

interface SourceProps extends RouteComponentProps, RouteComponentProps {
    networks: OrderedMap<string, NetworkData>;
    network: string;
}

const Source = withRouter(({ networks, network, match: { params } }: SourceProps) => {
    const { contractCategory, contractName } = params as { contractCategory: string, contractName: string };
    const networkDetails = networks.get(network);
    if (!networkDetails || !networkDetails.addresses[contractCategory] || !networkDetails.addresses[contractCategory][contractName]) {
        return <>not found</>;
    }
    const abi = networkDetails.addresses[contractCategory][contractName].abi;
    return <pre>{JSON.stringify(abi, null, "    ")}</pre>;
});

export default Source;
