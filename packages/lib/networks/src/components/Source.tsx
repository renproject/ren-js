import * as qs from "query-string";
import * as React from "react";

import { History, Location } from "history";
import { match, withRouter } from "react-router-dom";

import axios from "axios";

interface SourceState {
    raw: string | null;
}

interface SourceProps {
    abi: false;

    // withRouter props
    history: History;
    location: Location;
    match: match<SourceProps>;
    staticContext: undefined;
}

class Source extends React.Component<SourceProps, SourceState> {
    constructor(props: SourceProps) {
        super(props);
        this.state = {
            raw: null,
        };
    }

    public async componentDidMount() {
        const address = qs.parse(this.props.location.search).address;

        const URL = `https://api-kovan.etherscan.io/api?module=contract&action=getsourcecode&address=${address}`;

        const result = (await axios.get(URL)).data.result[0];

        console.log(result);
        // tslint:disable-next-line:prefer-const
        let raw = result.ABI ? result.ABI : result.ABI;

        try {
            raw = JSON.stringify(JSON.parse(raw), null, 4);
        } catch (err) {
            // No ABI available - ignore error
        }

        this.setState({ raw });
    }

    public render() {
        const { raw } = this.state;
        return <pre>{raw === null ? "" : raw}</pre>;
    }
}

export default withRouter(Source);
