import * as React from "react";

import axios from "axios";

import { HashRouter, Route } from "react-router-dom";

import Main from "./Main";

import "../styles/App.css";
import Source from "./Source";

const commitHash = require("../commitHash.json");

interface AppProps {

}

interface AppState {
    outOfDate: boolean;
}

class App extends React.Component<AppProps, AppState> {
    constructor(props: AppProps) {
        super(props);
        this.state = {
            outOfDate: false,
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
        const { outOfDate } = this.state;
        return (
            <HashRouter>
                <>
                    <Route path="/source" component={Source} />
                    <div className="App">
                        {outOfDate ? <OutOfDate /> : null}
                        <Route path="/" exact component={Main} />
                    </div>
                </>
            </HashRouter>
        );
    }
}

class OutOfDate extends React.Component {
    public render = () => <div className="outOfDate">This page is out of date. Force refresh the window to update the page (Ctrl-Shift-R or Cmd-Shift-R).</div>;
}

export default App;
