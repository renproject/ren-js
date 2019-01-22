import * as React from "react";
import * as ReactDOM from "react-dom";

import App from "./components/App";
import registerServiceWorker from "./registerServiceWorker";

import { _catch_ } from "./components/ErrorBoundary";

import "./styles/index.css";

ReactDOM.render(
  _catch_(<App />),
  document.getElementById("root") as HTMLElement
);
registerServiceWorker();
