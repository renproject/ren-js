// tslint:disable: no-any

import * as Sentry from "@sentry/browser";

import { naturalTime } from "@renproject/react-components";

interface Details {
    description?: string;
    category?: string;
    level?: Sentry.Severity;
    ignoreNetwork?: boolean;
}

interface Described {
    description: string;
}

interface ShownToUser {
    shownToUser?: string;
}

let pageLoaded: Date;
export const pageLoadedAt = (time?: Date): string => {
    const loadedAt = time || pageLoaded;
    if (loadedAt) {
        return naturalTime(Math.floor(loadedAt.getTime() / 1000), {
            message: "Just now",
            suffix: "ago",
            countDown: false,
        });
    }
    pageLoaded = new Date();
    return pageLoaded.toUTCString();
};

// Determines whether or not this is a common network error (too many of these
// are being logged to Sentry)
const isNetworkError = (error: Error | any): boolean => {
    const message: string = ((error || {}).message || error).toString();

    if (
        message.match(/Network ?Error/i) ||
        message.match(/Failed to fetch/i) ||
        message.match(/Network request failed/i) ||
        message.match(/Wrong response id/i) ||
        message.match(/Request failed or timed out/i) ||
        message.match(/Returned values aren't valid, did it run Out of Gas\?/i) ||
        message.match(/Invalid JSON RPC response/i) ||
        message.match(/timeout of 0ms exceeded/i)
    ) {
        return true;
    }

    return false;
};

const rawError = (errorObject: Error) => {
    // https://stackoverflow.com/questions/11616630/json-stringify-avoid-typeerror-converting-circular-structure-to-json/11616993#11616993

    // Note: cache should not be re-used by repeated calls to JSON.stringify.
    let cache: any[] | null = [];
    const rawErrorJSON = JSON.stringify(errorObject, (key, value) => {
        if (key === "request") {
            return "... omitted";
        }
        if (cache && typeof value === "object" && value !== null) {
            if (cache.indexOf(value) !== -1) {
                // Duplicate reference found
                try {
                    // If this value does not reference a parent it can be deduped
                    return JSON.parse(JSON.stringify(value));
                } catch (error) {
                    // discard key if value cannot be deduped
                    return;
                }
            }
            // Store value in our collection
            cache.push(value);
        }
        return value;
    });
    cache = null; // Enable garbage collection

    return rawErrorJSON;
};

const _catchErr_ = <X extends Details>(error: any, details: X) => {
    if (!error || error._noCapture_) {
        return;
    }

    Sentry.withScope(scope => {
        // How long ago the page was loaded at
        scope.setExtra("pageLoadedAt", pageLoadedAt());

        // Category
        if (details.category) {
            scope.setTag("category", details.category);
        }

        // Level
        if (details.level) {
            scope.setLevel(details.level);
        }

        // Extra information
        Object.keys(details)
            .forEach(key => {
                scope.setExtra(key, details[key]);
            });

        if (error && error.response) {
            scope.setExtra("responseData", error.response.data);
            scope.setExtra("responseStatus", error.response.status);
        }

        scope.setExtra("caught", true);
        scope.setExtra("zRawError", rawError(error));

        // tslint:disable-next-line: no-console
        console.error(error);

        // Check if we should ignore the error
        if (details.ignoreNetwork && isNetworkError(error)) {
            return;
        }

        Sentry.captureException(error);

    });
};

// Background exceptions are thrown in background loops and actions
export const _catchBackgroundErr_ = <X extends Details & Described>(error: any, details: X | string) => {
    _catchErr_(error, { ignoreNetwork: true, ...(typeof details === "string" ? { description: details } : details), category: "background_exception" });
};

// Interaction exceptions are thrown as a direct result of a user interaction
export const _catchInteractionErr_ = <X extends Details & Described & ShownToUser>(error: any, details: X | string) => {
    _catchErr_(error, { ...(typeof details === "string" ? { description: details } : details), category: "interaction_exception" });
};

export const _ignoreErr_ = <X extends Details & Described & ShownToUser>(error: any, details?: X | string) => {
    if (details) {
        console.error(details, error);
    } else {
        console.error(error);
    }
};
