import * as React from "react";

import { InfoLabel, LabelLevel, Loading } from "@renproject/react-components";

import { _catchInteractionErr_ } from "../../../lib/errors";
import { Commitment, Token } from "../../../state/generalTypes";
import { network } from "../../../state/sdkContainer";
import { Popup } from "../Popup";

export const TokenAllowance: React.StatelessComponent<{
    token: Token,
    amount: string,
    commitment: Commitment | null,
    orderID: string;
    submit: (orderID: string) => Promise<void>,
    hide?: () => void,
}> = ({ token, amount, commitment, orderID, submit, hide }) => {
    const [submitting, setSubmitting] = React.useState(false);
    const [error, setError] = React.useState(null as Error | null);
    const [failedTransaction, setFailedTransaction] = React.useState(null as string | null);

    const onSubmit = () => {
        setError(null);
        setSubmitting(true);
        submit(orderID).catch((err) => {
            setSubmitting(false);

            // Ignore user denying error in MetaMask.
            if (String(err.message || err).match(/User denied transaction signature/)) {
                return;
            }

            _catchInteractionErr_(err);
            const match = String(err.message || err).match(/"transactionHash": "(0x[a-fA-F0-9]{64})"/);
            if (match && match.length >= 2) {
                setFailedTransaction(match[1]);
                err = new Error("Transaction reverted.");
            }
            setError(err);
        });
    };
    return <Popup cancel={!submitting ? hide : undefined}>
        <div className="address-input">
            <div className="popup--body">
                <h2>Transfer Approval</h2>
                <div className="address-input--message">
                    Please approve the transfer of {amount} {token.toUpperCase()}.
                    <br />
                    <br />
                </div>
                {error ? <span className="red">
                    Error submitting to Ethereum <InfoLabel level={LabelLevel.Warning}>{`${error.message || error}`}</InfoLabel>
                    {failedTransaction ? <>
                        <br />
                        See the <a className="blue" href={`https://dashboard.tenderly.dev/tx/${network.contracts.chain}/${failedTransaction}/error`}>Transaction Stack Trace</a> for more details.
                    </> : null}
                </span> : null}
                <div className="popup--buttons">
                    <button className="button open--confirm" disabled={submitting || commitment === null} onClick={onSubmit}>{submitting ? <Loading alt={true} /> : "Approve"}</button>
                </div>
            </div>
        </div>
    </Popup>;
};
