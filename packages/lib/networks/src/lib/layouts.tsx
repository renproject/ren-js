import * as React from "react";

import Web3 from "web3";

import { camelCase, pascalCase, snakeCase, titleCase } from "change-case";
import { OrderedMap } from "immutable";
import { Link } from "react-router-dom";
import { Category, NetworkData } from "./networks";

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

const web3 = new Web3();

const formatAddress = (address: string) => address ? web3.utils.toChecksumAddress(address) : address;

export type FormatFN = (networkData: NetworkData, nameFormatter: TextTransform) => JSX.Element;

const table: FormatFN = (networkData: NetworkData, nameFormatter: TextTransform) => {
    return <table>
        <tbody>
            {Object.keys(networkData.addresses).map((category: string) =>
                <>
                    <tr><td className="borderless"><h4 key={category}>{pascalCase(category)}</h4></td></tr>
                    {Object.keys(networkData.addresses[category]).map((contractName: string) =>
                        <tr key={contractName}>
                            <td>
                                {nameFormatter(contractName)}
                            </td>
                            <td className="monospace">
                                {formatAddress(networkData.addresses[category][contractName].address)}
                            </td>
                            <td>
                                <Link to={`/source?address=${networkData.addresses[category][contractName].address}`}>ABI</Link>
                            </td>
                            <td>
                                <a href={`${networkData.etherscan}/address/${networkData.addresses[category][contractName].address}#code`}>Code</a>
                            </td>
                            <td>
                                {networkData.addresses[category][contractName].version}
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

const swapper: FormatFN = (networkData: NetworkData, nameFormatter: TextTransform) => {
    return <pre><code>{`{
    "network": "${networkData.name}",
    "ethereum": {
        "network": "kovan",
        "url": "${networkData.infura}",
        "renExAtomicSwapper": "${formatAddress(networkData.addresses[Category.RenEx].renExAtomicSwapper.address)}",
        "renExSettlement": "${formatAddress(networkData.addresses[Category.RenEx].renExSettlement.address)}",
        "orderbook": "${formatAddress(networkData.addresses[Category.RenEx].renExBalances.address)}",
        "wyre": "${formatAddress(networkData.addresses[Category.Other].wyre.address)}"
    }
}`}
    </code></pre>;
};


export function renexGo(networkData: NetworkData, nameFormatter: TextTransform) {
    return <pre><code>{`{
    "network": "${networkData.name}",
    "ingress": "https://renex-ingress-${networkData.name}.herokuapp.com",
    "infura": "${networkData.infura}",
    "etherscan": "${networkData.etherscan}",
    "ethNetwork": "${networkData.chain}",
    "ethNetworkLabel": "${titleCase(networkData.chain)}",
    "ledgerNetworkId": 42,
    "contracts": [
        {
            "darknodeRegistry": "${formatAddress(networkData.addresses[Category.Republic].darknodeRegistry.address)}",
            "orderbook": "${formatAddress(networkData.addresses[Category.Republic].orderbook.address)}",
            "renExTokens": "${formatAddress(networkData.addresses[Category.RenEx].renExTokens.address)}",
            "renExBalances": "${formatAddress(networkData.addresses[Category.RenEx].renExBalances.address)}",
            "renExSettlement": "${formatAddress(networkData.addresses[Category.RenEx].renExSettlement.address)}",
            "wyre": "${formatAddress(networkData.addresses[Category.Other].wyre.address)}"
        }
    ],
    "tokens": {
        "TUSD": "${formatAddress(networkData.addresses[Category.Tokens].TUSD.address)}",
        "DGX": "${formatAddress(networkData.addresses[Category.Tokens].DGX.address)}",
        "REN": "${formatAddress(networkData.addresses[Category.Tokens].REN.address)}",
        "OMG": "${formatAddress(networkData.addresses[Category.Tokens].OMG.address)}",
        "ZRX": "${formatAddress(networkData.addresses[Category.Tokens].ZRX.address)}"
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
