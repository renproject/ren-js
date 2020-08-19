import "react-circular-progressbar/dist/styles.css";

import { Asset, Chain, Tx } from "@renproject/interfaces";
import { RenNetworkDetails } from "@renproject/contracts";
import { extractError } from "@renproject/utils";
import React from "react";
import { buildStyles, CircularProgressbar } from "react-circular-progressbar";

import { _catchInteractionErr_ } from "../../../lib/errors";
import { ReactComponent as BurnIcon } from "../../../scss/images/burn.svg";
import { defaultNumberOfConfirmations } from "../../../state/sdkContainer";
import {
    Container,
    ContainerBody,
    ContainerBottom,
    ContainerButtons,
    ContainerHeader,
} from "../../views/Container";
import { ErrorScreen } from "../../views/ErrorScreen";
import { ExternalLink } from "../../views/ExternalLink";
import { Mini } from "../../views/Mini";
import { TransparentButton, TransparentLoading } from "../../views/Styled";

interface Props {
    mini: boolean;
    txHash: Tx | null;
    networkDetails: RenNetworkDetails;
    txCount: number;
    token: Asset;
    ethereumConfirmations: number | undefined;
    submit: (retry?: boolean) => Promise<void>;
    // tslint:disable-next-line: react-unused-props-and-state
    requestNotificationPermission(): Promise<{
        error?: string | undefined;
    } | null>;
    showNotification(title: string, body: string): Promise<null>;
}

export const SubmitBurnToEthereum: React.FC<Props> = ({
    mini,
    txHash,
    networkDetails,
    txCount,
    token,
    ethereumConfirmations,
    submit,
    showNotification,
}) => {
    const [submitting, setSubmitting] = React.useState(false);
    const [error, setError] = React.useState(null as string | null);
    const [failedTransaction, setFailedTransaction] = React.useState(
        null as string | null,
    );

    const confirmationsRequired = defaultNumberOfConfirmations(
        Asset.ETH,
        networkDetails,
    );

    const onSubmit = React.useCallback(async () => {
        setError(null);
        setFailedTransaction(null);
        setSubmitting(true);
        try {
            const beforeDeposit = new Date().getTime() / 1000;
            await submit(error !== null);
            const afterDeposit = new Date().getTime() / 1000;

            // Check if waiting for the deposit took longer than 30
            // seconds. This is to avoid showing a notification if the
            // user had the window closed when the TX was confirmed and
            // has just reopened the window.
            const secondsWaited = afterDeposit - beforeDeposit;
            if (secondsWaited >= 30) {
                // tslint:disable-next-line: insecure-random
                showNotification(
                    `Ethereum Transaction Confirmed`,
                    `${confirmationsRequired} confirmations passed`,
                ).catch(console.error);
            }
        } catch (error) {
            setSubmitting(false);
            let shownError = error;

            // Ignore user denying error in MetaMask.
            if (
                String(shownError.message || shownError).match(
                    /User denied transaction signature/,
                )
            ) {
                return;
            }

            _catchInteractionErr_(
                shownError,
                "Error in SubmitToEthereum: submit",
            );
            const match = String(shownError.message || shownError).match(
                /"transactionHash": "(0x[a-fA-F0-9]{64})"/,
            );
            if (match && match.length >= 2) {
                setFailedTransaction(match[1]);
                shownError = new Error("Transaction reverted.");
            }
            setError(extractError(shownError));
        }
    }, [submit, error, confirmationsRequired, showNotification]);

    // Once txHash is available, call `onSubmit`.
    const [initialized, setInitialized] = React.useState(false);
    React.useEffect(() => {
        if (!initialized) {
            setInitialized(true);
            if (txHash) {
                onSubmit().catch(console.error);
            }
        }
    }, [initialized, txHash, onSubmit]);

    if (mini) {
        return (
            <Mini
                token={token}
                message={
                    submitting ? "Submitting to Ethereum" : "Submit to Ethereum"
                }
            />
        );
    }

    if (error) {
        return (
            <ErrorScreen
                errorTitle={<>Error submitting to Ethereum</>}
                errorMessage={error}
                retryMessage={<>Submit to Ethereum</>}
                retry={onSubmit}
            >
                {failedTransaction ? (
                    <>
                        <p />
                        <p>
                            See the{" "}
                            <ExternalLink
                                className="blue"
                                href={`${networkDetails.etherscan}/tx/${failedTransaction}`}
                            >
                                Transaction Status
                            </ExternalLink>{" "}
                            for more details.
                        </p>
                    </>
                ) : null}
            </ErrorScreen>
        );
    }

    return (
        <Container>
            <div className="burn-container submit-burn-to-ethereum">
                <ContainerBody>
                    <ContainerHeader icon={<BurnIcon />} />
                    <div className="container--body--message">
                        <span>
                            {txHash &&
                            txHash.chain === Chain.Ethereum &&
                            !error ? (
                                <p>
                                    Waiting for {confirmationsRequired} Ethereum
                                    confirmations
                                    <br />
                                </p>
                            ) : (
                                <>
                                    To receive your {token}, submit a release
                                    transaction to the Ethereum network via
                                    MetaMask.
                                </>
                            )}
                        </span>
                    </div>
                </ContainerBody>
            </div>
            {txHash && txHash.chain === Chain.Ethereum && !error ? (
                <div className="submit-burn-progress">
                    <CircularProgressbar
                        value={ethereumConfirmations || 0}
                        maxValue={confirmationsRequired}
                        text={""}
                        strokeWidth={3}
                        styles={buildStyles({
                            // Whether to use rounded or flat corners on the ends - can use 'butt' or 'round'
                            strokeLinecap: "butt",

                            // How long animation takes to go from one percentage to another, in seconds
                            pathTransitionDuration: 0.5,

                            // Can specify path transition in more detail, or remove it entirely
                            // pathTransition: 'none',

                            pathColor: "#006FE8",
                            trailColor: "#d6d6d6",
                            backgroundColor: "#ffffff",
                        })}
                    />
                    <div className="submit-burn-progress--body">
                        <div className="submit-burn-progress--pending">
                            Pending
                        </div>
                        <div className="submit-burn-progress--hash">
                            TX:{" "}
                            <ExternalLink
                                href={`${networkDetails.etherscan}/tx/${txHash.hash}`}
                            >
                                {txHash.hash}
                            </ExternalLink>
                        </div>
                    </div>
                </div>
            ) : (
                <ContainerBottom>
                    <ContainerButtons>
                        <TransparentButton
                            className="button open--confirm"
                            disabled={submitting}
                            onClick={onSubmit}
                        >
                            {submitting ? (
                                <>
                                    Submitting to Ethereum
                                    <TransparentLoading alt={true} />
                                </>
                            ) : txCount > 1 ? (
                                <>
                                    {" "}
                                    Submit <b>{txCount}</b> transactions to
                                    Ethereum
                                </>
                            ) : (
                                <>Submit to Ethereum</>
                            )}
                        </TransparentButton>
                    </ContainerButtons>
                </ContainerBottom>
            )}
        </Container>
    );
};
