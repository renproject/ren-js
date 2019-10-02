import * as React from "react";

import axios from "axios";
import { HashRouter, Route } from "react-router-dom";
import { OrderedMap } from "immutable";

import { NetworkData } from "../lib/networks";
import chaosnet from "../networks/chaosnet";
import devnet from "../networks/devnet";
import localnet from "../networks/localnet";
import mainnet from "../networks/mainnet";
import testnet from "../networks/testnet";
import "../styles/App.css";
import Loading from "./Loading";
import Main from "./Main";
import Source from "./Source";

const commitHash = require("../commitHash.json");

interface AppProps {

}

interface AppState {
    outOfDate: boolean;
    networks: OrderedMap<string, NetworkData> | null;
}

class App extends React.Component<AppProps, AppState> {
    constructor(props: AppProps) {
        super(props);
        this.state = {
            outOfDate: false,
            networks: OrderedMap({ mainnet, chaosnet, testnet, devnet, localnet }),
        };
    }

    public async componentDidMount() {
        let using;
        let latest;
        try {
            using = commitHash.HASH;
            latest = (await axios.get(`./commitHash.json?v=${Math.random().toString(36).substring(7)}`)).data.HASH;
            if (using !== latest) {
                this.setState({ outOfDate: true });
            }
        } catch (err) {
            console.log(`Using commit hash ${using} but latest commit hash is ${latest}`);
            console.error(err);
        }
    }

    public render() {
        const { outOfDate, networks } = this.state;
        return (
            <HashRouter>
                <>
                    <Route path="/source" component={Source} />
                    {networks && networks.size > 0 ? <div className="App">
                        {outOfDate ? <OutOfDate /> : null}
                        {/* tslint:disable-next-line:jsx-no-lambda */}
                        <Route path="/" exact render={() => <Main networks={networks} />} />
                    </div> : <Loading />}
                </>
            </HashRouter>
        );
    }
}

class OutOfDate extends React.Component {
    public render = () => <div className="outOfDate">This page is out of date. Force refresh the window to update the page (Ctrl-Shift-R or Cmd-Shift-R).</div>;
}

export default App;
