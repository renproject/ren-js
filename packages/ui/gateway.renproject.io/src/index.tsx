import * as React from "react";
import * as ReactDOM from "react-dom";

import { ThemeProvider } from "styled-components";
import { Provider } from "unstated";

import { AppRouter } from "./components/controllers/AppRouter";
import { initializeErrorLogging } from "./lib/errorLogging";
// Import css first so that styles are consistent across dev and build
import "./scss/index.scss";
import { theme } from "./scss/theme";
import { SDKContainer } from "./state/sdkContainer";
import { UIContainer } from "./state/uiContainer";

initializeErrorLogging();

const uiContainer = new UIContainer();
const sdkContainer = new SDKContainer(uiContainer);

ReactDOM.render(
    <div className="_ren">
        <Provider inject={[uiContainer, sdkContainer]}>
            <ThemeProvider theme={theme}>
                <AppRouter />
            </ThemeProvider>
        </Provider>
    </div>,
    document.getElementById("root") as HTMLElement
);
