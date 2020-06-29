import React from "react";

import { ReactComponent as AlertIcon } from "../../scss/images/alert.svg";
import {
    Container, ContainerBody, ContainerBottom, ContainerButtons, ContainerDetails, ContainerHeader,
} from "./Container";

interface Props {
    errorTitle: React.ReactNode;
    errorMessage: React.ReactNode;
    retryMessage: React.ReactNode;
    retry: () => (void | Promise<void>);
}

export const ErrorScreen: React.FC<Props> = ({
    errorTitle, errorMessage, retryMessage, retry, children,
}) => {
    const [showFullError, setShowFullError] = React.useState(false);
    const toggleShowFullError = React.useCallback(() => { setShowFullError(!showFullError); }, [showFullError, setShowFullError]);

    const onClick = () => {
        setShowFullError(false);
        retry();
    };

    return <Container>
        <ContainerBody>
            <ContainerHeader className="container--body--alert" icon={<AlertIcon />} />
            <ContainerDetails>
                <div className="container--error">
                    <div className="container--error--title">{errorTitle}</div>
                    <div className="container--error--body">{!showFullError && typeof errorMessage === "string" && errorMessage.length > 100 ? <>{errorMessage.slice(0, 100)}...{" "}<span role="button" className="link" onClick={toggleShowFullError}>See more</span></> : errorMessage}</div>
                    {children}
                </div>
            </ContainerDetails>
        </ContainerBody>
        <ContainerBottom>
            <ContainerButtons>
                <button className="button open--confirm" onClick={onClick}>
                    {retryMessage}
                </button>
            </ContainerButtons>
        </ContainerBottom>
    </Container>;
};
