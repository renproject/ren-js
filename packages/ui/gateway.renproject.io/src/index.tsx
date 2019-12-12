// Import css first so that styles are consistent across dev and build
import "./styles/index.scss";

import * as React from "react";
import * as ReactDOM from "react-dom";

import { ThemeProvider } from "styled-components";
import { Provider } from "unstated";

import { App } from "./components/App";
import { initializeSentry } from "./sentry";
import { SDKContainer } from "./state/sdkContainer";
import { UIContainer } from "./state/uiContainer";

import { colors } from "./theme";

initializeSentry();

const sdkContainer = new SDKContainer();
const uiContainer = new UIContainer();

ReactDOM.render(
    <Provider inject={[sdkContainer, uiContainer]}>
        <ThemeProvider theme={colors}>
            <App />
        </ThemeProvider>
    </Provider>,
    document.getElementById("root") as HTMLElement
);
