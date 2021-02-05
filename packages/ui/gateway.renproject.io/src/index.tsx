import React from "react";
import ReactDOM from "react-dom";
import { HashRouter as Router } from "react-router-dom";
import { ThemeProvider } from "styled-components";

import { Routes } from "./components/controllers/Routes";
import { initializeErrorLogging } from "./lib/errorLogging";
// Import css first so that styles are consistent across dev and build
import "./scss/index.scss";
import { theme } from "./scss/theme";
import { MessageContainer } from "./state/messageContainer";
import { SDKContainer } from "./state/sdkContainer";
import { TransferContainer } from "./state/transferContainer";
import { UIContainer } from "./state/uiContainer";

initializeErrorLogging();

const render = (Component: () => JSX.Element) => {
    ReactDOM.render(
        <TransferContainer.Provider>
            <UIContainer.Provider>
                <SDKContainer.Provider>
                    <ThemeProvider theme={theme}>
                        <Router basename={process.env.PUBLIC_URL}>
                            <MessageContainer.Provider>
                                <Component />
                            </MessageContainer.Provider>
                        </Router>
                    </ThemeProvider>
                </SDKContainer.Provider>
            </UIContainer.Provider>
        </TransferContainer.Provider>,
        document.getElementById("root") as HTMLElement,
    );
};

render(Routes);

// Enable hot-reloading in development environment.

// tslint:disable-next-line: no-any
if ((module as any).hot) {
    // tslint:disable-next-line: no-any
    (module as any).hot.accept("./components/controllers/Routes", () => {
        const NextRoutes = require("./components/controllers/Routes").Routes;
        render(NextRoutes);
    });
}
