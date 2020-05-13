import * as React from "react";

import { capitalCase } from "change-case";
import { OrderedMap } from "immutable";
import { RouteComponentProps, withRouter } from "react-router";

import { formatFn, FormatType, table } from "../lib/layouts";
import { NetworkData } from "../lib/networks";
import chaosnet from "../networks/chaosnet";
import devnet from "../networks/devnet";
import localnet from "../networks/localnet";
import mainnet from "../networks/mainnet";
import testnet from "../networks/testnet";
import { DisplayNetwork } from "./DisplayNetwork";

export const networks = OrderedMap({ mainnet, chaosnet, testnet, devnet, localnet });

interface Props extends RouteComponentProps {
}

export const publicNetwork = (_: unknown, network: string) => network === "mainnet" || network === "testnet";

export const Main = withRouter(({ history, location }: Props) => {

    const [format, setFormat] = React.useState(FormatType.TABLE);

    const network = location.pathname.replace("/", "") || "mainnet";

    const handleInput = (event: React.FormEvent<HTMLInputElement>): void => {
        const element = (event.target as HTMLInputElement);
        if (element.name === "network") {
            history.replace(`/${element.value}`);
        } else if (element.name === "format") {
            setFormat(element.value as FormatType);
        }
    };

    const networkDetails = networks.get(network);

    return (
        <div className={["Main", `Main-${network}`].join(" ")}>
            <div className="network controls">
                <h1>Contract Index</h1>
                <table className="config-table"><tbody>
                    <tr>
                        {networks.filter(publicNetwork(0, network) ? publicNetwork : () => true).map((_: NetworkData | undefined, networkName: string | undefined) =>
                            <td key={networkName} className={[network === networkName ? `config-checked` : ""].join(" ")}>
                                <label><input
                                    type="radio"
                                    name="network"
                                    value={networkName}
                                    checked={network === networkName}
                                    onChange={handleInput}
                                />
                                    {capitalCase(networkName || "")}
                                </label></td>
                        ).valueSeq().toArray()
                        }
                    </tr>
                </tbody></table>
                <br />
                <table className="config-table"><tbody>
                    <tr>
                        {formatFn.map((_, formatOpt: string | undefined) =>
                            <td key={formatOpt} className={[format === formatOpt ? `config-checked` : "", "borderless"].join(" ")}>
                                <label>
                                    <input
                                        type="radio"
                                        name="format"
                                        value={formatOpt}
                                        checked={format === formatOpt}
                                        onChange={handleInput}
                                    />
                                    {formatOpt}
                                </label>
                            </td>
                        ).valueSeq().toArray()}
                    </tr>
                </tbody></table>
            </div>
            {networkDetails ? <DisplayNetwork
                // key={network}
                format={formatFn.get(format) || table}
                networkData={networkDetails}
            /> : <>Unknown network {network}</>}
        </div >
    );
});
