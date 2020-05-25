import "react-circular-progressbar/dist/styles.css";

import * as React from "react";

import { RenNetworkDetails } from "@renproject/contracts";
import { Asset, Chain, Tx } from "@renproject/interfaces";
import { Loading } from "@renproject/react-components";
import { extractError } from "@renproject/utils";
import { lighten } from "polished";
import { buildStyles, CircularProgressbar } from "react-circular-progressbar";
import styled from "styled-components";

import { ReactComponent as BurnIcon } from "../../../images/icons/burn.svg";
import { _catchInteractionErr_ } from "../../../lib/errors";
import { defaultNumberOfConfirmations } from "../../../state/sdkContainer";
import {
    Container, ContainerBody, ContainerBottom, ContainerButtons, ContainerHeader,
} from "../Container";
import { ExternalLink } from "../ExternalLink";
import { ErrorScreen } from "./ErrorScreen";
import { Mini } from "./Mini";

const TransparentButton = styled.button`
        position: relative;
        opacity: 1;
        &:disabled {
            color: rgba(255, 255, 255, 1.0);
            background-color: ${p => lighten(0.5, p.theme.primaryColor)};
            opacity: 1 !important;
        }
    `;
const TransparentLoading = styled(Loading)`
        position: absolute;
        margin-left: 20px;
        margin-top: 3px;
        display: inline-block;
        border-color: rgba(255, 255, 255, 0.5) transparent rgba(255, 255, 255, 0.5) transparent;
    `;

export const SubmitBurnToEthereum: React.StatelessComponent<{
    mini: boolean,
    txHash: Tx | null,
    networkDetails: RenNetworkDetails,
    txCount: number,
    token: Asset,
    ethereumConfirmations: number | undefined,
    submit: (retry?: boolean) => Promise<void>,
    requestNotificationPermission(): Promise<{
        error?: string | undefined;
    } | null>;
    showNotification(title: string, body: string): Promise<null>;
}> = ({ mini, txHash, networkDetails, txCount, token, ethereumConfirmations, submit, showNotification }) => {
    const [submitting, setSubmitting] = React.useState(false);
    const [error, setError] = React.useState(null as string | null);
    const [failedTransaction, setFailedTransaction] = React.useState(null as string | null);

    const confirmationsRequired = defaultNumberOfConfirmations(Asset.ETH, networkDetails);

    const onSubmit = React.useCallback(async () => {
        setError(null);
        setFailedTransaction(null);
        setSubmitting(true);
        try {
            const beforeDeposit = (new Date()).getTime() / 1000;
            await submit(error !== null);
            const afterDeposit = (new Date()).getTime() / 1000;

            // Check if waiting for the deposit took longer than 30
            // seconds. This is to avoid showing a notification if the
            // user had the window closed when the TX was confirmed and
            // has just reopened the window.
            const secondsWaited = afterDeposit - beforeDeposit;
            if (secondsWaited >= 30) {
                // tslint:disable-next-line: insecure-random
                showNotification(`Ethereum Transaction Confirmed`, `${confirmationsRequired} confirmations passed`).catch(console.error);
            }
        } catch (error) {
            setSubmitting(false);
            let shownError = error;

            // Ignore user denying error in MetaMask.
            if (String(shownError.message || shownError).match(/User denied transaction signature/)) {
                return;
            }

            _catchInteractionErr_(shownError, "Error in SubmitToEthereum: submit");
            const match = String(shownError.message || shownError).match(/"transactionHash": "(0x[a-fA-F0-9]{64})"/);
            if (match && match.length >= 2) {
                setFailedTransaction(match[1]);
                shownError = new Error("Transaction reverted.");
            }
            setError(extractError(shownError));
        }
    }, [submit, error, confirmationsRequired, showNotification]);

    // useEffect replaces `componentDidMount` and `componentDidUpdate`.
    // To limit it to running once, we use the initialized hook.
    const [initialized, setInitialized] = React.useState(false);
    React.useEffect(() => {
        if (!initialized) {
            setInitialized(true);
            if (txHash) {
                onSubmit().catch(console.error);
            }
        }
    }, [initialized, txHash, onSubmit]);

    // const [requested, setRequested] = React.useState(false);
    // React.useEffect(() => {
    //     if (!requested && ethereumConfirmations !== undefined) {
    //         requestNotificationPermission().catch(console.error);
    //         setRequested(true);
    //     }
    // }, [requested, setRequested, ethereumConfirmations, requestNotificationPermission]);

    if (mini) { return <Mini token={token} message={submitting ? "Submitting to Ethereum" : "Submit to Ethereum"} />; }

    if (error) {
        return <ErrorScreen
            errorTitle={<>Error submitting to Ethereum</>}
            errorMessage={error}
            retryMessage={<>Submit to Ethereum</>}
            retry={onSubmit}
        >
            {failedTransaction ? <>
                <p />
                <p>See the <ExternalLink className="blue" href={`${networkDetails.etherscan}/tx/${failedTransaction}`}>Transaction Status</ExternalLink> for more details.</p>
            </> : null}
        </ErrorScreen>;
    }

    return <Container>
        <div className="burn-container submit-burn-to-ethereum">
            <ContainerBody>
                <ContainerHeader icon={<BurnIcon />} />
                <div className="container--body--message">
                    <span>
                        {txHash && txHash.chain === Chain.Ethereum && !error ?
                            <p>Waiting for {confirmationsRequired} Ethereum confirmations<br /></p> :
                            <>To receive your {token}, submit a release transaction to the Ethereum network via MetaMask.</>
                        }
                    </span>
                </div>
            </ContainerBody>
        </div>
        {txHash && txHash.chain === Chain.Ethereum && !error ? <div className="submit-burn-progress"><CircularProgressbar
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
                <div className="submit-burn-progress--pending">Pending</div>
                <div className="submit-burn-progress--hash">TX: <ExternalLink href={`${networkDetails.etherscan}/tx/${txHash.hash}`}>{txHash.hash}</ExternalLink></div>
            </div>
        </div> :
            <ContainerBottom>
                {/* {txHash && txHash.chain === Chain.Ethereum && !error ?
                        <ExternalLink className="no-underline" href={txUrl(txHash, networkDetails)}>
                            <LabelledDiv style={{ textAlign: "center", maxWidth: "unset" }} inputLabel="Transaction Hash" width={125} loading={true} >{txHash.hash}</LabelledDiv>
                        </ExternalLink> : */}
                <ContainerButtons>
                    <TransparentButton className="button open--confirm" disabled={submitting} onClick={onSubmit}>
                        {submitting ? <>Submitting to Ethereum<TransparentLoading alt={true} /></> : txCount > 1 ? <>{" "}Submit <b>{txCount}</b> transactions to Ethereum</> : <>Submit to Ethereum</>}
                    </TransparentButton>
                </ContainerButtons>
                {/* } */}
            </ContainerBottom>
        }
    </Container>;
};
