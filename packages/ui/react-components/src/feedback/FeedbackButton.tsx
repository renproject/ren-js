import * as React from "react";

import { ReactComponent as Feedback } from "./feedback.svg";

import "./styles.scss";

export const FeedbackButton: React.SFC<{ url: string }> = (props: { url: string }) => {
    return <a href={props.url} target="_blank" rel="noopener noreferrer" className="feedbackButton">
        <Feedback />
        <span className="feedbackButton--info">Feedback</span>
    </a>;
};
