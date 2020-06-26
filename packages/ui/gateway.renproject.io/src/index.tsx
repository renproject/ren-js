import * as React from "react";
import * as ReactDOM from "react-dom";

import { ConnectedRouter } from "./components/controllers/ConnectedRouter";
import { initializeErrorLogging } from "./lib/errorLogging";
// Import css first so that styles are consistent across dev and build
import "./scss/index.scss";

// tslint:disable-next-line: no-any
if ((module as any).hot) {
    // tslint:disable-next-line: no-any
    (module as any).hot.accept();
}

initializeErrorLogging();

ReactDOM.render(
    <div className="_ren">
        <ConnectedRouter />
    </div>,
    document.getElementById("root") as HTMLElement
);
