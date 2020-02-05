import * as React from "react";

import { capitalCase } from "change-case";
import { OrderedMap } from "immutable";
import { RouteComponentProps, withRouter } from "react-router";

import { formatFn, FormatType, table } from "../lib/layouts";
import { NetworkData } from "../lib/networks";
import Network from "./Network";

const defaultState = {
    format: FormatType.TABLE,
};


interface MainProps extends RouteComponentProps {
    networks: OrderedMap<string, NetworkData>;
    network: string;
}

// tslint:disable-next-line: no-any
export const publicNetwork = (_: any, network: string) => network === "chaosnet" || network === "testnet";

class Main extends React.Component<MainProps, typeof defaultState> {
    constructor(props: MainProps) {
        super(props);
        this.state = defaultState;
    }
    // public async componentDidMount() {
    //     const network = qs.parse(this.props.location.search).network;
    //     if (network && typeof network === "string" && this.props.networks.has(network)) {
    //         this.setState({ network });
    //     }
    // }
    public render() {
        const { networks, network } = this.props;
        const { format } = this.state;
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
                                        onChange={this.handleInput}
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
                                            onChange={this.handleInput}
                                        />
                                        {formatOpt}
                                    </label>
                                </td>
                            ).valueSeq().toArray()}
                        </tr>
                    </tbody></table>
                </div>
                {networkDetails ? <Network
                    // key={network}
                    format={formatFn.get(format) || table}
                    networkData={networkDetails}
                /> : <>Unknown network {network}</>}
            </div >
        );
    }

    private readonly handleInput = (event: React.FormEvent<HTMLInputElement>): void => {
        const element = (event.target as HTMLInputElement);
        if (element.name === "network") {
            this.props.history.replace(`/${element.value}`);
        } else {
            this.setState((state) => ({ ...state, [element.name]: element.value }));
        }
    }

}

export default withRouter(Main);
