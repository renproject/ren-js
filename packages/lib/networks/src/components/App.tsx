import * as React from "react";

import Main from "./Main";

import { HashRouter, Route } from "react-router-dom";

import "../styles/App.css";
import Source from "./Source";

interface AppProps {

}

interface AppState {
}

class App extends React.Component<AppProps, AppState> {
    constructor(props: AppProps) {
        super(props);
        this.state = {};
    }

    public render() {
        return (
            <HashRouter>
                <>
                    <Route path="/source" component={Source} />
                    <div className="App">
                        <Route path="/" exact component={Main} />
                    </div>
                </>
            </HashRouter>
        );
    }
}

export default App;
