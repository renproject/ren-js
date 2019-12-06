// Import css first so that styles are consistent across dev and build
import "./styles/index.scss";

import * as React from "react";
import * as ReactDOM from "react-dom";

import { Router } from "react-router-dom";
import { ThemeProvider } from "styled-components";
import { Provider } from "unstated";

import { App } from "./components/controllers/App";
import { history } from "./lib/history";
import { initializeSentry } from "./sentry";
import { SDKContainer } from "./state/sdkContainer";
import { UIContainer } from "./state/uiContainer";

import { colors } from "./theme";

initializeSentry();

const sdkContainer = new SDKContainer();
const uiContainer = new UIContainer();

ReactDOM.render(
    <Provider inject={[sdkContainer, uiContainer]}>
        <Router history={history}>

            <ThemeProvider theme={colors}>
                <App />
            </ThemeProvider>
        </Router>
    </Provider>,
    document.getElementById("root") as HTMLElement
);
