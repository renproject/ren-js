import * as React from "react";

import { HashRouter as Router, Route, Switch } from "react-router-dom";

import { MessageContainer } from "../../state/messageContainer";
import { Main } from "./Main";

const NotFound = () => <div>404 Not Found</div>;

export const AppRouter = () => {
    return (
        <Router basename={process.env.PUBLIC_URL}>
            <MessageContainer.Provider>
                <Switch>
                    <Route path="/" exact component={Main} />
                    <Route path="/get-transfers" exact /> {/* Don't render any visual components. */}
                    <Route component={NotFound} />
                </Switch>
            </MessageContainer.Provider>
        </Router>
    );
};
