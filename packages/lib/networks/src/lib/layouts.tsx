import * as React from "react";

import { camelCase, pascalCase, snakeCase } from "change-case";
import { OrderedMap } from "immutable";
import { Link } from "react-router-dom";
import { toChecksumAddress } from "web3-utils";

import { NetworkData } from "./networks";

export type TextTransform = (name: string) => string;

export enum Case {
    DEFAULT_CASE = "default-case",
    TITLE_CASE = "TitleCase",
    SNAKE = "snake_case",
    CAMEL = "camelCase",
}

export const caseFn = OrderedMap<string, TextTransform>({
    [Case.DEFAULT_CASE]: (name: string): string => name,
    [Case.TITLE_CASE]: pascalCase,
    [Case.SNAKE]: snakeCase,
    [Case.CAMEL]: camelCase,
});

const formatAddress = (address: string) => address ? toChecksumAddress(address) : address;

export type FormatFN = (networkData: NetworkData, nameFormatter: TextTransform) => JSX.Element;

const table: FormatFN = (networkData: NetworkData, nameFormatter: TextTransform) => {
    return <table className="layout">
        <tbody>
            {Object.keys(networkData.addresses).map((category: string) =>
                <>
                    <tr><td className="borderless"><h4 key={category}>{pascalCase(category)}</h4></td></tr>
                    {Object.keys(networkData.addresses[category]).map((contractName: string) =>
                        <tr key={contractName}>
                            <td className="contract-name">
                                <a href={`${networkData.etherscan}/address/${networkData.addresses[category][contractName].address}`}>
                                    {category.match("[Tt]okens") ? nameFormatter(contractName).toUpperCase() : nameFormatter(contractName)}
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

const json: FormatFN = (networkData: NetworkData, nameFormatter: TextTransform) => {
    return <>
        <p><a href={`/networks/${networkData.name}.json`}>Raw JSON</a></p>
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
