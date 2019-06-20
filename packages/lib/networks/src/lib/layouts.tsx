import * as React from "react";

import { OrderedMap } from "immutable";
import { Link } from "react-router-dom";
import { toChecksumAddress } from "web3-utils";
import { titleCase } from "change-case";

import { NetworkData } from "./networks";

const formatAddress = (address: string) => address ? toChecksumAddress(address) : address;

export type FormatFN = (networkData: NetworkData) => JSX.Element;

const table: FormatFN = (networkData: NetworkData) => {
    return <table className="layout">
        <tbody>
            {Object.keys(networkData.addresses).map((category: string) =>
                <>
                    <tr><td className="borderless"><h4 key={category}>{titleCase(category)}</h4></td></tr>
                    {Object.keys(networkData.addresses[category]).map((contractName: string) =>
                        <tr key={contractName}>
                            <td className="contract-name">
                                <a href={`${networkData.etherscan}/address/${networkData.addresses[category][contractName].address}`}>
                                    {category.match("[Tt]okens") ? contractName.toUpperCase() : contractName}
                                </a>
                                {networkData.addresses[category][contractName].new === true ?
                                    <span style={{ color: "#191" }} title="Updated recently">{" "}●</span> :
                                    <></>
                                }
                            </td>
                            <td className="monospace">
                                {formatAddress(networkData.addresses[category][contractName].address)}
                            </td>
                            <td>
                                <Link to={`/source?address=${networkData.addresses[category][contractName].address}&network=${networkData.chain}`}>ABI</Link>
                            </td>
                        </tr>
                    )}
                </>
            )}
        </tbody>
    </table>;
};

const json: FormatFN = (networkData: NetworkData) => {
    return <>
        <p><a href={`${process.env.PUBLIC_URL}/networks/${networkData.name}.json`}>Raw JSON</a></p>
        <pre><code>
            {JSON.stringify(networkData, null, 4)}
        </code></pre>
    </>;
};

export enum Format {
    TABLE = "Table",
    JSON = "JSON",
}

export const formatFn = OrderedMap<string, FormatFN>({
    [Format.TABLE]: table,
    [Format.JSON]: json,
});
