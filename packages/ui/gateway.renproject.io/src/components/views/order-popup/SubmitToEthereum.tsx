import * as React from "react";

import { InfoLabel, LabelLevel, Loading } from "@renproject/react-components";

import { _catchInteractionErr_ } from "../../../lib/errors";
import { Token, Tx } from "../../../state/generalTypes";
import { network } from "../../../state/sdkContainer";
import { Popup } from "../Popup";

export const SubmitToEthereum: React.StatelessComponent<{
    orderID: string,
    txHash: Tx | null,
    submit: (orderID: string, retry?: boolean) => Promise<void>,
    hide?: () => void,
}> = ({ orderID, txHash, submit, hide }) => {
    const [submitting, setSubmitting] = React.useState(false);
    const [error, setError] = React.useState(null as Error | null);
    const [failedTransaction, setFailedTransaction] = React.useState(null as string | null);

    const onSubmit = React.useCallback(async () => {
        setError(null);
        setFailedTransaction(null);
        setSubmitting(true);
        try {
            await submit(orderID, error !== null);
        } catch (error) {
            setSubmitting(false);
            let shownError = error;

            // Ignore user denying error in MetaMask.
            if (String(shownError.message || shownError).match(/User denied transaction signature/)) {
                return;
            }

            _catchInteractionErr_(shownError);
            const match = String(shownError.message || shownError).match(/"transactionHash": "(0x[a-fA-F0-9]{64})"/);
            if (match && match.length >= 2) {
                setFailedTransaction(match[1]);
                shownError = new Error("Transaction reverted.");
            }
            setError(shownError);
        }
    }, [orderID, submit, error]);

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

    return <Popup cancel={!submitting || txHash ? hide : undefined}>
        <div className="address-input">
            <div className="popup--body">
                <h2>Submit shift to Ethereum</h2>
                <div className="address-input--message">
                    Submit shift to Ethereum.{txHash ? <InfoLabel><span className="break-all">Tx Hash: {txHash.hash}</span></InfoLabel> : <></>}
                    <br />
                    <br />
                </div>
                {error ? <span className="red">
                    Error submitting to Ethereum <InfoLabel level={LabelLevel.Warning}>{`${error.message || error}`}</InfoLabel>
                    {failedTransaction ? <>
                        <br />
                        See the <a className="blue" href={`https://dashboard.tenderly.dev/tx/${network.contracts.chain}/${failedTransaction}/error`}>Transaction Stack Trace</a> for more details.
                        <br />
                        If you see <span className="monospace">"nonce hash already spent"</span> your trade may have already gone through.
                    </> : null}
                </span> : null}
                <div className="popup--buttons">
                    <button className="button open--confirm" disabled={submitting} onClick={onSubmit}>{submitting ? <Loading alt={true} /> : "Submit"}</button>
                </div>
            </div>
        </div>
    </Popup>;
};
