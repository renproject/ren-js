import * as React from "react";

import { HashRouter as Router, Route, Switch } from "react-router-dom";

import { GetTransfers } from "./GetTransfers";
import { Main } from "./Main";

const NotFound = () => <div>404 Not Found</div>;

export const AppRouter = () => {
    return (
        <Router basename={process.env.PUBLIC_URL}>
            <Switch>
                <Route path="/" exact component={Main} />
                <Route path="/get-transfers" exact component={GetTransfers} />
                <Route component={NotFound} />
            </Switch>
        </Router>
    );
};
