import * as React from "react";

import { HashRouter as Router } from "react-router-dom";
import { ThemeProvider } from "styled-components";

import { theme } from "../../scss/theme";
import { MessageContainer } from "../../state/messageContainer";
import { SDKContainer } from "../../state/sdkContainer";
import { TransferContainer } from "../../state/transferContainer";
import { UIContainer } from "../../state/uiContainer";
import { Routes } from "./Routes";

export const ConnectedRouter = () => (
    <TransferContainer.Provider>
        <UIContainer.Provider>
            <SDKContainer.Provider>
                <ThemeProvider theme={theme}>
                    <Router basename={process.env.PUBLIC_URL}>
                        <MessageContainer.Provider>
                            <Routes />
                        </MessageContainer.Provider>
                    </Router>
                </ThemeProvider>
            </SDKContainer.Provider>
        </UIContainer.Provider>
    </TransferContainer.Provider>
);
