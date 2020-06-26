import * as React from "react";
import * as ReactDOM from "react-dom";

import { ThemeProvider } from "styled-components";

import { AppRouter } from "./components/controllers/AppRouter";
import { initializeErrorLogging } from "./lib/errorLogging";
// Import css first so that styles are consistent across dev and build
import "./scss/index.scss";
import { theme } from "./scss/theme";
import { SDKContainer } from "./state/sdkContainer";
import { TransferContainer } from "./state/transferContainer";
import { UIContainer } from "./state/uiContainer";

// tslint:disable-next-line: no-any
if ((module as any).hot) {
    // tslint:disable-next-line: no-any
    (module as any).hot.accept();
}

initializeErrorLogging();

ReactDOM.render(
    <div className="_ren">
        <TransferContainer.Provider>
            <UIContainer.Provider>
                <SDKContainer.Provider>
                    <ThemeProvider theme={theme}>
                        <AppRouter />
                    </ThemeProvider>
                </SDKContainer.Provider>
            </UIContainer.Provider>
        </TransferContainer.Provider>
    </div>,
    document.getElementById("root") as HTMLElement
);
