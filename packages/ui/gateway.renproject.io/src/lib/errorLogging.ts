import * as Sentry from "@sentry/browser";

import { ExtraErrorData } from "@sentry/integrations";

import { SENTRY_DSN, SENTRY_ENVIRONMENT, SOURCE_VERSION } from "./environmentVariables";
import { pageLoadedAt } from "./errors";

/**
 * Configure error logging details.
 * While GatewayJS is gaining stability, the Ren Project dev team receives
 * details about errors that are caught in gateway.renproject.io.
 */
export const initializeErrorLogging = () => {

    // Initialize Sentry error logging
    Sentry.init({
        // Used to define the project to log errors to
        dsn: SENTRY_DSN,

        // Used to separate production and staging errors
        environment: SENTRY_ENVIRONMENT,

        // Used to track errors across versions
        release: SOURCE_VERSION,

        // Only throw errors generated from scripts at these URLs
        whitelistUrls: [
            /.*renproject.*/i,
        ],

        integrations: [new ExtraErrorData()],
    });

    Sentry.configureScope((scope) => {
        // We set this to true when logging to Sentry explicitly.
        scope.setExtra("caught", false);

        scope.setExtra("release", SOURCE_VERSION);

        scope.setExtra("pageLoadedAt", pageLoadedAt());
    });
};
