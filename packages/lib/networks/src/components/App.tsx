import * as React from "react";

import { OrderedMap } from "immutable";
import { HashRouter, Route } from "react-router-dom";

import { NetworkData } from "../lib/networks";
import chaosnet from "../networks/chaosnet";
import devnet from "../networks/devnet";
import localnet from "../networks/localnet";
import mainnet from "../networks/mainnet";
import testnet from "../networks/testnet";
import "../styles/App.scss";
import Loading from "./Loading";
import Main from "./Main";
import Source from "./Source";

interface AppProps {

}

interface AppState {
    outOfDate: boolean;
    networks: OrderedMap<string, NetworkData> | null;
}

class OutOfDate extends React.Component {
    public render = () => <div className="outOfDate">This page is out of date. Force refresh the window to update the page (Ctrl-Shift-R or Cmd-Shift-R).</div>;
}

class App extends React.Component<AppProps, AppState> {
    constructor(props: AppProps) {
        super(props);
        this.state = {
            outOfDate: false,
            networks: OrderedMap({ mainnet, chaosnet, testnet, devnet, localnet }),
        };
    }

    public render() {
        const { outOfDate, networks } = this.state;
        return (
            <HashRouter>
                <>
                    {networks && networks.size > 0 ? <div className="App">
                        {outOfDate ? <OutOfDate /> : null}
                        {/* tslint:disable-next-line:jsx-no-lambda react-this-binding-issue */}
                        <Route path="/" exact render={() => <Main network={"chaosnet"} networks={networks} />} />
                        {/* tslint:disable-next-line:jsx-no-lambda react-this-binding-issue */}
                        {networks.map((_, network) => <Route key={network} path={`/${network}`} exact render={() => <Main key={"main"} network={network || "chaosnet"} networks={networks} />} />).valueSeq().toArray()}
                        {/* tslint:disable-next-line:jsx-no-lambda react-this-binding-issue */}
                        {networks.map((_, network) => <Route key={network} path={`/${network}/:contractCategory/:contractName`} exact render={() => <Source key={"main"} network={network || "chaosnet"} networks={networks} />} />).valueSeq().toArray()}
                    </div> : <Loading />}
                </>
            </HashRouter>
        );
    }
}

export default App;
