import * as React from "react";

import { HashRouter as Router, Route, Switch } from "react-router-dom";

import { ENABLE_TEST_ENDPOINT } from "../lib/environmentVariables";
import { Main } from "./controllers/Main";
import { TestEnvironment } from "./TestEnvironment";

const NotFound: React.FC<{}> = props => {
    return (
        <div>404 Not Found</div>
    );
};

export const App: React.FC<{}> = props => {
    return (
        <Router basename={process.env.PUBLIC_URL}>
            <Switch>
                <Route path="/" exact component={Main} />
                {ENABLE_TEST_ENDPOINT && <Route path="/test" exact component={TestEnvironment} />}
                <Route component={NotFound} />
            </Switch>
        </Router>
    );
};
