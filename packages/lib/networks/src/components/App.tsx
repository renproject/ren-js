import * as React from "react";

import { OrderedMap } from "immutable";
import { HashRouter, Route } from "react-router-dom";

import chaosnet from "../networks/chaosnet";
import devnet from "../networks/devnet";
import localnet from "../networks/localnet";
import mainnet from "../networks/mainnet";
import testnet from "../networks/testnet";
import "../styles/App.scss";
import { Main } from "./Main";
import { Source } from "./Source";

const networks = OrderedMap({ mainnet, chaosnet, testnet, devnet, localnet });

const App = () => <HashRouter>
    <div className="App">
        {/* tslint:disable-next-line:jsx-no-lambda react-this-binding-issue */}
        <Route path="/" exact render={() => <Main network={"mainnet"} networks={networks} />} />
        {/* tslint:disable-next-line:jsx-no-lambda react-this-binding-issue */}
        {networks.map((_, network) => <Route key={network} path={`/${network}`} exact render={() => <Main key={"main"} network={network || "mainnet"} networks={networks} />} />).valueSeq().toArray()}
        {/* tslint:disable-next-line:jsx-no-lambda react-this-binding-issue */}
        {networks.map((_, network) => <Route key={network} path={`/${network}/:contractCategory/:contractName`} exact render={() => <Source key={"main"} network={network || "mainnet"} networks={networks} />} />).valueSeq().toArray()}
    </div>
</HashRouter>;

export default App;
