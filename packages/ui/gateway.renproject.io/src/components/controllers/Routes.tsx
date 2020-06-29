import React from "react";
import { Route, Switch } from "react-router-dom";

import { Main } from "./Main";

const NotFound = () => <div>404 Not Found</div>;

export const Routes = () => (
    <Switch>
        <Route path="/" exact component={Main} />
        <Route path="/get-transfers" exact /> {/* Don't render any visual components. */}
        <Route component={NotFound} />
    </Switch>
);
