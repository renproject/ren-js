import * as React from "react";

import { HashRouter as Router, Route, Switch } from "react-router-dom";

import { GetTrades } from "./GetTrades";
import { Main } from "./Main";

const NotFound = () => {
    return (
        <div>404 Not Found</div>
    );
};

export const App = () => {
    return (
        <Router basename={process.env.PUBLIC_URL}>
            <Switch>
                <Route path="/" exact component={Main} />
                <Route path="/get-trades" exact component={GetTrades} />
                <Route component={NotFound} />
            </Switch>
        </Router>
    );
};
