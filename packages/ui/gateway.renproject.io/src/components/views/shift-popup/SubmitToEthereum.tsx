import * as React from "react";

import { InfoLabel, LabelLevel, Loading } from "@renproject/react-components";
import { Tx } from "@renproject/interfaces";
import styled from "styled-components";
import { NetworkDetails } from "@renproject/utils/build/main/types/networks";

import { _catchInteractionErr_ } from "../../../lib/errors";
import { txUrl } from "../../../lib/txUrl";
import { LabelledDiv } from "../LabelledInput";
import { OpeningShiftMini } from "../OpeningShiftMini";
import { Popup } from "../Popup";

const TransparentButton = styled.button`
        position: relative;
        &:disabled {
            color: rgba(255, 255, 255, 0.5);
        }
    `;
const TransparentLoading = styled(Loading)`
        position: absolute;
        margin-left: 20px;
        margin-top: 3px;
        display: inline-block;
        border-color: rgba(255, 255, 255, 0.5) transparent rgba(255, 255, 255, 0.5) transparent;
    `;

export const SubmitToEthereum: React.StatelessComponent<{
    mini: boolean,
    txHash: Tx | null,
    networkDetails: NetworkDetails,
    submit: (retry?: boolean) => Promise<void>,
}> = ({ mini, txHash, networkDetails, submit }) => {
    const [submitting, setSubmitting] = React.useState(false);
    const [error, setError] = React.useState(null as Error | null);
    const [failedTransaction, setFailedTransaction] = React.useState(null as string | null);

    const onSubmit = React.useCallback(async () => {
        setError(null);
        setFailedTransaction(null);
        setSubmitting(true);
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
            setError(shownError);
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

    if (mini) { return <OpeningShiftMini />; }

    return <Popup mini={mini}>
        <div className="submit-to-ethereum">
            <div className="popup--body">
                {error ? <span className="ethereum-error red">
                    Error submitting to Ethereum <InfoLabel level={LabelLevel.Warning}>{`${error.message || error}`}</InfoLabel>
                    {failedTransaction ? <>
                        <br />
                        See the <a className="blue" href={`${networkDetails.contracts.etherscan}/tx/${failedTransaction}`}>Transaction Stack Trace</a> for more details.
                        <br />
                    </> : null}
                </span> : null}
                {txHash ?
                    <a className="no-underline" target="_blank" rel="noopener noreferrer" href={txUrl(txHash, networkDetails)}>
                        <LabelledDiv style={{ textAlign: "center", maxWidth: "unset" }} inputLabel="Transaction Hash" width={125} loading={true} >{txHash.hash}</LabelledDiv>
                    </a> :
                    <div className="popup--buttons">
                        <TransparentButton className="button open--confirm" disabled={submitting} onClick={onSubmit}>Submit to Ethereum {submitting ? <TransparentLoading alt={true} /> : ""}</TransparentButton>
                    </div>
                }
            </div>
        </div>
    </Popup>;
};
