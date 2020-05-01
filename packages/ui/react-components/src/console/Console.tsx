import * as React from "react";

import "./styles.scss";

// tslint:disable-next-line: no-any
type LogEntry = any;

interface Props extends React.DetailedHTMLProps<React.HTMLAttributes<HTMLDivElement>, HTMLDivElement> {
    logs: LogEntry[] | IterableIterator<LogEntry>;
}

/**
 * Console is a component for showing a scrolling list of Elements.
 * When a new item is added, it automatically scrolls to to the end of the list.
 */
export class Console extends React.Component<Props> {
    private bottomElement: HTMLElement | null = null;

    public render = (): JSX.Element => {
        const { logs, className, ...props } = this.props;
        return (
            <div role="log" {...props} className={["console", className].join(" ")}>
                {(logs as LogEntry[]).map(e => <span>{e}</span>)}
                <br className="console--bottom" ref={this.updateBottomElement} />
            </div>);
    }

    public updateBottomElement = (ref: HTMLBRElement | null) => { this.bottomElement = ref; };

    public componentDidMount = (): void => {
        this.scrollToBottom();
    }

    public componentWillReceiveProps = (): void => {
        this.scrollToBottom();
    }

    private readonly scrollToBottom = (): void => {
        // Render any new logs before scrolling to bottom
        this.forceUpdate(() => {
            if (this.bottomElement) {
                this.bottomElement.scrollIntoView({ behavior: "smooth" });
            }
        });
    }
}
