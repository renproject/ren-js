import * as React from "react";

import { NetworkDetails, Tx } from "@renproject/interfaces";
import { Loading } from "@renproject/react-components";
import { extractError } from "@renproject/utils";
import { lighten } from "polished";
import styled from "styled-components";

import { _catchInteractionErr_ } from "../../../lib/errors";
import { txUrl } from "../../../lib/txUrl";
import { LabelledDiv } from "../LabelledInput";
import { Popup } from "../Popup";
import { ConnectedMini } from "./Mini";

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
    networkDetails: NetworkDetails,
    submit: (retry?: boolean) => Promise<void>,
}> = ({ mini, txHash, networkDetails, submit }) => {
    const [submitting, setSubmitting] = React.useState(false);
    const [error, setError] = React.useState(null as string | null);
    const [showFullError, setShowFullError] = React.useState(false);
    const [failedTransaction, setFailedTransaction] = React.useState(null as string | null);
    const toggleShowFullError = React.useCallback(() => { setShowFullError(!showFullError); }, [showFullError, setShowFullError]);

    const onSubmit = React.useCallback(async () => {
        setError(null);
        setFailedTransaction(null);
        setSubmitting(true);
        setShowFullError(false);
        try {
            await submit(error !== null);
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
    }, [submit, error]);

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

    if (mini) { return <ConnectedMini message={submitting ? "Submitting to Ethereum" : "Submit to Ethereum"} />; }

    return <Popup mini={mini}>
        <div className="submit-to-ethereum">
            <div className="popup--body">
                {error ? <div className="ethereum-error red">
                    Error submitting to Ethereum: {!showFullError && error.length > 100 ? <>{error.slice(0, 100)}...{" "}<span role="button" className="link" onClick={toggleShowFullError}>See more</span></> : error}
                    {failedTransaction ? <>
                        <br />
                        See the <a className="blue" href={`${networkDetails.contracts.etherscan}/tx/${failedTransaction}`}>Transaction Stack Trace</a> for more details.
                        <br />
                    </> : null}
                </div> : null}
            </div>
        </div>
        <div className="deposit-address">
            <div className="popup--body--actions">
                {txHash && !error ?
                    <a className="no-underline" target="_blank" rel="noopener noreferrer" href={txUrl(txHash, networkDetails)}>
                        <LabelledDiv style={{ textAlign: "center", maxWidth: "unset" }} inputLabel="Transaction Hash" width={125} loading={true} >{txHash.hash}</LabelledDiv>
                    </a> :
                    <div className="popup--buttons">
                        <TransparentButton className="button open--confirm" disabled={submitting} onClick={onSubmit}>{submitting ? <>Submitting to Ethereum<TransparentLoading alt={true} /></> : <>Submit to Ethereum</>}</TransparentButton>
                    </div>
                }
            </div>
        </div>
    </Popup>;
};
