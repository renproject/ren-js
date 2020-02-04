import * as React from "react";

import { InfoLabel, LabelLevel, Loading } from "@renproject/react-components";
import { Tx } from "@renproject/ren-js-common";
import styled from "styled-components";

import { _catchInteractionErr_ } from "../../../lib/errors";
import { network } from "../../../state/sdkContainer";
import { OpeningShiftMini } from "../OpeningShiftMini";
import { Popup } from "../Popup";

export const SubmitToEthereum: React.StatelessComponent<{
    mini: boolean,
    txHash: Tx | null,
    submit: (retry?: boolean) => Promise<void>,
}> = ({ mini, txHash, submit }) => {
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
    return <Popup mini={mini}>
        <div className="submit-to-ethereum">
            <div className="popup--body">
                {/* <h2>Submit shift to Ethereum</h2>
                <div className="address-input--message">
                    Submit shift to Ethereum.{txHash ? <InfoLabel><span className="break-all">Tx Hash: {txHash.hash}</span></InfoLabel> : <></>}
                    <br />
                    <br />
                </div> */}
                {error ? <span className="ethereum-error red">
                    Error submitting to Ethereum <InfoLabel level={LabelLevel.Warning}>{`${error.message || error}`}</InfoLabel>
                    {failedTransaction ? <>
                        <br />
                        See the <a className="blue" href={`https://dashboard.tenderly.dev/tx/${network.contracts.chain}/${failedTransaction}/error`}>Transaction Stack Trace</a> for more details.
                        <br />
                        If you see <span className="monospace">"nonce hash already spent"</span> your trade may have already gone through.
                    </> : null}
                </span> : null}
                <div className="popup--buttons">
                    <TransparentButton className="button open--confirm" disabled={submitting} onClick={onSubmit}>Complete with MetaMask {submitting ? <TransparentLoading alt={true} /> : ""}</TransparentButton>
                </div>
            </div>
        </div>
    </Popup>;
};
