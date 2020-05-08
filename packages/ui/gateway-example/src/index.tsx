// tslint:disable: no-console react-this-binding-issue

import * as React from "react";
import * as ReactDOM from "react-dom";

import { GatewayExample } from "./main";
import "./style.scss";

const Index = () => {
    return <div className="test-background">
        {window.web3 ? <GatewayExample web3={window.web3} /> : <p>Please use a Web3 browser</p>}
    </div>;
};

ReactDOM.render(<Index />, document.getElementById("root") as HTMLElement);

