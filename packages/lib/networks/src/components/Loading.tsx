import * as React from "react";

interface LoadingProps {
    alt?: boolean;
}

interface LoadingState {
}

/**
 * Loading is a visual component that renders a spinning animation
 */
class Loading extends React.Component<LoadingProps, LoadingState> {
    public render(): JSX.Element {
        const { alt } = this.props;
        return (
            <div className={`loading lds-dual-ring ${alt ? "alt" : ""}`} />
        );
    }
}

export default Loading;
