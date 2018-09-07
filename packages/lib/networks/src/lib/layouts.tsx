import * as React from "react";

import Web3 from "web3";

import { camelCase, lowerCase, snakeCase } from "change-case";
import { OrderedMap } from "immutable";
import { Link } from "react-router-dom";
import { Category, CategoryAddresses, NetworkData } from "./networks";

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

const web3 = new Web3();

const formatAddress = (address: string) => web3.utils.toChecksumAddress(address);

export type FormatFN = (networkData: NetworkData, nameFormatter: TextTransform) => JSX.Element;

const table: FormatFN = (networkData: NetworkData, nameFormatter: TextTransform) => {
    return <table>
        {networkData.addresses.map((addresses: CategoryAddresses, category: string) =>
            <>
                <h4 key={category}>{category}</h4>
                {addresses.map((addressAndVersion: { address: string; version: string; }, contract: string) =>
                    <tr key={contract}>
                        <td>
                            {nameFormatter(contract)}
                        </td>
                        <td className="monospace">
                            {formatAddress(addressAndVersion.address)}
                        </td>
                        <td>
                            <Link to={`/source?address=${addressAndVersion.address}`}>ABI</Link>
                        </td>
                        <td>
                            <a href={`https://kovan.etherscan.io/address/${addressAndVersion.address}#code`}>Code</a>
                        </td>
                        <td>
                            {addressAndVersion.version}
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
        {networkData.addresses.map((addresses: CategoryAddresses, category: string) => {
            const lastCategory = networkData.addresses.keySeq().findIndex(k => k === category) === networkData.addresses.size - 1;
            return <>
                {`    "${lowerCase(category)}": {\n`}
                {addresses.map((addressAndVersion: { address: string; version: string; }, contract: string) => {
                    const index = addresses.keySeq().findIndex(k => k === contract);
                    const last = index === addresses.size - 1;

                    return `        "${nameFormatter(contract)}": "${formatAddress(addressAndVersion.address)}"${last ? "" : ","}\n`;
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
        "renExAtomicSwapper": "${formatAddress(networkData.addresses.get(Category.RenEx).get("RenExAtomicSwapper").address)}",
        "renExAtomicInfo": "${formatAddress(networkData.addresses.get(Category.RenEx).get("RenExAtomicInfo").address)}",
        "renExSettlement": "${formatAddress(networkData.addresses.get(Category.RenEx).get("RenExSettlement").address)}",
        "orderbook": "${formatAddress(networkData.addresses.get(Category.RenEx).get("RenExBalances").address)}"
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
            "darknodeRegistry": "${formatAddress(networkData.addresses.get(Category.Republic).get("DarknodeRegistry").address)}",
            "orderbook": "${formatAddress(networkData.addresses.get(Category.Republic).get("Orderbook").address)}",
            "renExTokens": "${formatAddress(networkData.addresses.get(Category.RenEx).get("RenExTokens").address)}",
            "renExBalances": "${formatAddress(networkData.addresses.get(Category.RenEx).get("RenExBalances").address)}",
            "renExSettlement": "${formatAddress(networkData.addresses.get(Category.RenEx).get("RenExSettlement").address)}",
            "renExAtomicInfo": "${formatAddress(networkData.addresses.get(Category.RenEx).get("RenExAtomicInfo").address)}"
        }
    ],
    "tokens": {
        "ABC": "${formatAddress(networkData.addresses.get(Category.Tokens).get("ABC").address)}",
        "DGX": "${formatAddress(networkData.addresses.get(Category.Tokens).get("DGX").address)}",
        "REN": "${formatAddress(networkData.addresses.get(Category.Tokens).get("REN").address)}",
        "XYZ": "${formatAddress(networkData.addresses.get(Category.Tokens).get("XYZ").address)}"
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
