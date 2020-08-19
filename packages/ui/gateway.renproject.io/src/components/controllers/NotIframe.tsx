import React from "react";

import { ExternalLink } from "../views/ExternalLink";

const { version } = require("../../../package.json");

/**
 * NotIframe is shown if the user goes to the page directly in their browser.
 */
export const NotIframe: React.FC = () => (
    <span className="not-in-iframe">
        <h1>GatewayJS</h1>
        <p>Version {version}</p>
        <p>See <ExternalLink href="https://github.com/renproject/ren-js">github.com/renproject/ren-js</ExternalLink> for more information about GatewayJS.</p>
    </span>
);
