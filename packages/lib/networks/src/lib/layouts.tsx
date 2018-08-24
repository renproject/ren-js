import * as React from "react";

import { camelCase, lowerCase, snakeCase } from "change-case";
import { OrderedMap } from "immutable";
import { Link } from "react-router-dom";
import { Category, NetworkData } from "./networks";

export type TextTransform = (name: string) => string;

export enum Case {
    DEFAULT_CASE = "DefaultCase",
    SNAKE = "snake_case",
    CAMEL = "camelCase",
}

export const caseFn = OrderedMap<string, TextTransform>({
    [Case.DEFAULT_CASE]: (name: string): string => name,
    [Case.SNAKE]: snakeCase,
    [Case.CAMEL]: camelCase,
});

export type FormatFN = (networkData: NetworkData, nameFormatter: TextTransform) => JSX.Element;

const table: FormatFN = (networkData: NetworkData, nameFormatter: TextTransform) => {
    return <table>
        {networkData.addresses.map((addresses: OrderedMap<string, string>, category: string) =>
            <>
                <h4 key={category}>{category}</h4>
                {addresses.map((address: string, contract: string) =>
                    <tr key={contract}>
                        <td>
                            {nameFormatter(contract)}
                        </td>
                        <td className="monospace">
                            {address}
                        </td>
                        <td>
                            <Link to={`/source?address=${address}`}>ABI</Link>
                        </td>
                        <td>
                            <a href={`https://kovan.etherscan.io/address/${address}#code`}>Code</a>
                        </td>
                    </tr>).toArray()}
            </>
        ).toArray()
        }
    </table>;
};

const json: FormatFN = (networkData: NetworkData, nameFormatter: TextTransform) => {
    return <pre><code>
        {"{\n"}
        {networkData.addresses.map((addresses: OrderedMap<string, string>, category: string) => {
            const lastCategory = networkData.addresses.keySeq().findIndex(k => k === category) === networkData.addresses.size - 1;
            return <>
                {`    "${lowerCase(category)}": {\n`}
                {addresses.map((address: string, contract: string) => {
                    const index = addresses.keySeq().findIndex(k => k === contract);
                    const last = index === addresses.size - 1;

                    return `        "${nameFormatter(contract)}": "${address}"${last ? "" : ","}\n`;
                }).toArray()}
                {`    }${lastCategory ? "" : ","}\n`}
            </>;
        }
        ).toArray()}
        {"}\n"}
    </code></pre>;
};

const swapper: FormatFN = (networkData: NetworkData, nameFormatter: TextTransform) => {
    return <pre><code>{`{
    "network": "${networkData.name}",
    "ethereum": {
        "network": "kovan",
        "url": "https://kovan.infura.io",
        "renExAtomicSwapper": "${networkData.addresses.get(Category.RenEx).get("RenExAtomicSwapper")}",
        "renExAtomicInfo": "${networkData.addresses.get(Category.RenEx).get("RenExAtomicInfo")}",
        "renExSettlement": "${networkData.addresses.get(Category.RenEx).get("RenExSettlement")}",
        "orderbook": "${networkData.addresses.get(Category.RenEx).get("RenExBalances")}"
    }
}`}
    </code></pre>;
};


export function renexGo(networkData: NetworkData, nameFormatter: TextTransform) {
    return <pre><code>{`{
    "network": "${networkData.name}",
    "ingress": "https://renex-ingress-${networkData.name}.herokuapp.com",
    "infura": "https://${networkData.chain}.infura.io",
    "etherscan": "https://${networkData.chain}.etherscan.io",
    "ethNetwork": "${networkData.chain}",
    "ethNetworkLabel": "${networkData.chain}",
    "ledgerNetworkId": 42,
    "contracts": [
        {
            "darknodeRegistry": "${networkData.addresses.get(Category.Republic).get("DarknodeRegistry")}",
            "orderbook": "${networkData.addresses.get(Category.Republic).get("Orderbook")}",
            "renExBalances": "${networkData.addresses.get(Category.RenEx).get("RenExBalances")}",
            "renExSettlement": "${networkData.addresses.get(Category.RenEx).get("RenExSettlement")}",
            "renExAtomicInfo": "${networkData.addresses.get(Category.RenEx).get("RenExAtomicInfo")}"
        }
    ],
    "tokens": {
        "ABC": "${networkData.addresses.get(Category.Tokens).get("ABC")}",
        "DGX": "${networkData.addresses.get(Category.Tokens).get("DGX")}",
        "REN": "${networkData.addresses.get(Category.Tokens).get("REN")}",
        "XYZ": "${networkData.addresses.get(Category.Tokens).get("XYZ")}"
    }
}`}
    </code></pre>;
}

export enum Format {
    TABLE = "Table",
    JSON = "JSON",
    SWAPPER = "Swapper",
    RENEX_GO = "renex-go",
}

export const formatFn = OrderedMap<string, FormatFN>({
    [Format.TABLE]: table,
    [Format.JSON]: json,
    [Format.SWAPPER]: swapper,
    [Format.RENEX_GO]: renexGo,
});
