import * as Sentry from "@sentry/browser";

import classNames from "classnames";
import React from "react";

import { _catchInteractionErr_ } from "../../lib/errors";

const defaultState = { // Entries must be immutable
    error: null as null | Error,
    errorInfo: null as null | React.ErrorInfo,
};

export class ErrorBoundary extends React.Component<Props, typeof defaultState> {
    constructor(props: Props) {
        super(props);
        this.state = defaultState;
    }

    public componentDidCatch = (error: Error, errorInfo: React.ErrorInfo) => {
        this.setState({
            error,
            errorInfo,
        });
        _catchInteractionErr_(error, {
            ...errorInfo,
            description: "Error caught in ErrorBoundary",
            shownToUser: "As Error Boundary",
        });
    }

    /**
     * The main render function.
     * @dev Should have minimal computation, loops and anonymous functions.
     */
    public render(): React.ReactNode {
        const { errorInfo, error } = this.state;
        const { mini, manualError, fullPage, onCancel, className, ...divProps } = this.props;
        if (error || this.props.manualError) {
            // Error path
            return (
                <div {...divProps} className={classNames(className, fullPage ? "gateway-container" : "")}>
                    <h2>{manualError ?
                        // tslint:disable-next-line: strict-type-predicates
                        mini && typeof manualError === "string" ? <>{manualError.slice(0, 14)}...</> :
                            manualError : <>Something went wrong.</>}</h2>
                    {!mini ? <>
                        {error || errorInfo ? <details style={{ whiteSpace: "pre-wrap" }}>
                            {error && error.toString()}
                            <br />
                            {errorInfo && errorInfo.componentStack}
                        </details> : <></>}
                        {fullPage ? <div className="container--buttons">
                            <button onClick={this.reportFeedback}>Report feedback</button>
                            <button onClick={onCancel}>Close</button>
                        </div> : null
                        }
                    </> : <></>}
                </div>
            );
        }
        // Normally, just render children
        return this.props.children;
    }

    private readonly reportFeedback = () => {
        Sentry.showReportDialog();
    }
}

interface Props extends React.DetailedHTMLProps<React.HTMLAttributes<HTMLDivElement>, HTMLDivElement> {
    mini?: boolean;

    manualError?: string;

    /**
     * fullPage specifies whether or not the Error Boundary is being rendered at
     * the top level of the page.
     */
    fullPage?: boolean;

    /**
     * If `fullPage` is true, then onCancel should also be provided.
     */
    onCancel?(): void;
}
