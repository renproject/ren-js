import * as React from "react";

import { OrderedMap } from "immutable";
import { RouteComponentProps, withRouter } from "react-router-dom";

import { NetworkData } from "../lib/networks";

interface Props extends RouteComponentProps, RouteComponentProps {
    networks: OrderedMap<string, NetworkData>;
    network: string;
}

export const Source = withRouter(({ networks, network, match: { params } }: Props) => {
    const { contractCategory, contractName } = params as { contractCategory: string, contractName: string };
    const networkDetails = networks.get(network);
    if (!networkDetails || !networkDetails.addresses[contractCategory] || !networkDetails.addresses[contractCategory][contractName]) {
        return <>not found</>;
    }
    const abi = networkDetails.addresses[contractCategory][contractName].abi;
    return <pre>{JSON.stringify(abi, null, "    ")}</pre>;
});
