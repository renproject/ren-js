import * as React from "react";

import { capitalCase } from "change-case";
import { OrderedMap } from "immutable";
import { Link } from "react-router-dom";
import { toChecksumAddress } from "web3-utils";

import { NetworkData } from "./networks";

const formatAddress = (address: string) => address ? toChecksumAddress(address) : address;

export type FormatFN = (networkData: NetworkData) => JSX.Element;

export const table: FormatFN = (networkData: NetworkData) => {
    return <table className="layout">
        {Object.keys(networkData.addresses).map((category: string) =>
            <tbody key={category}>
                <tr><td className="borderless"><h4>{capitalCase(category)}</h4></td></tr>
                {Object.keys(networkData.addresses[category]).map((contractName: string) =>
                    <tr key={contractName}>
                        <td className="contract-name">
                            <a href={`${networkData.etherscan}/address/${networkData.addresses[category][contractName]._address || networkData.addresses[category][contractName].address}`}>
                                {category.match("[Tt]okens") ? contractName.toUpperCase() : contractName}
                            </a>
                            {networkData.addresses[category][contractName].new === true ?
                                <span style={{ color: "#191" }} title="Updated recently">{" "}●</span> :
                                <></>
                            }
                        </td>
                        <td className="monospace">
                            {networkData.addresses[category][contractName].address ?
                                formatAddress(networkData.addresses[category][contractName].address) :
                                <span className="contract-description">{networkData.addresses[category][contractName].description}</span>
                            }
                        </td>
                        <td>
                            {networkData.addresses[category][contractName].abi ? <Link className="abi" to={`./${networkData.name}/${category}/${contractName}`}>🗎ABI</Link> : <></>}
                        </td>
                    </tr>
                )}
            </tbody>
        )}
    </table>;
};

const json: FormatFN = (networkData: NetworkData) => {
    return <>
        <p><a href={`${process.env.PUBLIC_URL}/networks/${networkData.name}.json`}>Raw JSON</a></p>
        <pre><code>
            {JSON.stringify(networkData, (name, value) => {
                return (name === "artifact" || name === "abi") ? undefined : value;
            }, 4)}
        </code></pre>
    </>;
};

export enum FormatType {
    TABLE = "Table",
    JSON = "JSON",
}

export const formatFn = OrderedMap<string, FormatFN>()
    .set(FormatType.TABLE, table)
    .set(FormatType.JSON, json);
