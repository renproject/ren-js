import * as React from "react";

import { HashRouter, Route } from "react-router-dom";

import "../styles/App.scss";
import { Main, networks } from "./Main";
import { Source } from "./Source";

const App = () => <HashRouter>
    <div className="App">
        {/* tslint:disable-next-line:jsx-no-lambda react-this-binding-issue */}
        <Route path="/" component={Main} />
        {/* tslint:disable-next-line:jsx-no-lambda react-this-binding-issue */}
        {networks.map((_, network) => <Route key={network} path={`/${network}/:contractCategory/:contractName`} exact render={() => <Source key={"main"} network={network || "mainnet"} networks={networks} />} />).valueSeq().toArray()}
    </div>
</HashRouter>;

export default App;
