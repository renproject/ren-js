import * as React from "react";

import { Case, caseFn, Format, formatFn } from "../lib/layouts";
import { NetworkData } from "../lib/networks";
import Network from "./Network";

interface MainState {
    format: Format;
    nameCase: Case;
}

interface MainProps {
    networks: NetworkData[];
}

class Main extends React.Component<MainProps, MainState> {
    constructor(props: MainProps) {
        super(props);
        this.state = {
            format: Format.TABLE,
            nameCase: Case.TITLE_CASE,
        };
    }
    public render() {
        const { format, nameCase } = this.state;
        const { networks } = this.props;
        console.log(networks);

        return (
            <div className="Main">
                <div className="network controls">
                    <h1>Contract Index</h1>
                    Version 0.1.1 (a)
                    <table>
                        Format
                        <tr>
                            {formatFn.map((_, formatOpt: Format) =>
                                <td key={formatOpt}><input type="radio"
                                    name="format"
                                    value={formatOpt}
                                    checked={format === formatOpt}
                                    onChange={this.handleInput}
                                />
                                    {formatOpt}
                                </td>
                            ).toArray()}
                        </tr>
                    </table>
                    {/* {format === Format.JSON ?
                        <table>
                            Case
                                < tr >
                                {
                                    caseFn.keySeq().toJS().map((nameCaseOpt: Case) =>
                                        <td key={nameCaseOpt}><input type="radio"
                                            name="nameCase"
                                            value={nameCaseOpt}
                                            checked={nameCase === nameCaseOpt}
                                            onChange={this.handleInput}
                                        />
                                            {nameCaseOpt}
                                        </td>
                                    )
                                }
                            </tr></table> : null
                    } */}
                </div>
                {networks.map((network: NetworkData) =>
                    <Network
                        key={network.name}
                        nameCase={caseFn.get(nameCase)}
                        format={formatFn.get(format)}
                        networkData={network}
                    />)
                }
            </div >
        );
    }

    private handleInput = (event: React.FormEvent<HTMLInputElement>): void => {
        const element = (event.target as HTMLInputElement);
        this.setState((state) => ({ ...state, [element.name]: element.value }));
    }

}

export default Main;
