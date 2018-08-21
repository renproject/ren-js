import * as React from "react";

import Main from "./Main";

import { createBrowserHistory } from "history";
import { Route, Router } from "react-router-dom";

import "../styles/App.css";
import Source from "./Source";

const history = createBrowserHistory();

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
            <Router history={history}>
                <>
                    <Route path="/source" component={Source} />
                    <div className="App">
                        <Route path="/" exact component={Main} />
                    </div>
                </>
            </Router>
        );
    }
}

export default App;
