import * as React from "react";

import { Loading, TokenIcon } from "@renproject/react-components";
import { TxStatus } from "@renproject/ren-js-common";

import { _catchInteractionErr_ } from "../../../lib/errors";
import { Token } from "../../../state/generalTypes";
import { Popup } from "../Popup";

const renderTxStatus = (status: TxStatus | null) => {
    switch (status) {
        case null:
            return "Submitting";
        case TxStatus.TxStatusNil:
            return "Submitting";
        case TxStatus.TxStatusConfirming:
            return "Checking for confirmations";
        case TxStatus.TxStatusPending:
            return "Executing";
        case TxStatus.TxStatusExecuting:
            return "Executing";
        case TxStatus.TxStatusDone:
            return "Done";
        case TxStatus.TxStatusReverted:
            return "Reverted";
    }
};

export const DepositReceived: React.StatelessComponent<{
    mini: boolean;
    token: Token;
    renTxHash: string | null;
    renVMStatus: TxStatus | null;
    submitDeposit: () => Promise<unknown>;
}> = ({ mini, token, renVMStatus, renTxHash, submitDeposit }) => {
    const [error, setError] = React.useState(null as Error | null);

    const onClick = React.useCallback(async () => {
        setError(null);
        if (submitDeposit) {
            try {
                await submitDeposit();
            } catch (error) {
                setError(error);
                _catchInteractionErr_(error, "Error in DepositReceived: submitDeposit");
            }
        }
    }, [submitDeposit]);

    // useEffect replaces `componentDidMount` and `componentDidUpdate`.
    // To limit it to running once, we use the initialized hook.
    const [initialized, setInitialized] = React.useState(false);
    React.useEffect(() => {
        if (!initialized) {
            setInitialized(true);
            // if (renTxHash) {
            onClick().catch(console.error);
            // }
        }
    }, [initialized, renTxHash, onClick]);

    if (mini) {
        return <Popup mini={mini}>
            <div className="side-strip"><TokenIcon token={token} /></div>
            <div className="popup--body--details">
                Submitting to RenVM
            </div>
        </Popup>;
    }

    return <Popup mini={mini}>
        <div className="deposit-address">
            <div className="popup--body submitting-to-renvm">
                {/* {token ? <TokenIcon className="token-icon" token={token} /> : null} */}
                {error ? <>
                    <div className="submitting-to-renvm--body">
                        <p style={{ marginTop: "20px", fontSize: "16px" }} className="red">Unable to submit to RenVM</p>
                        <p className="red">{error.message || error}</p>
                        <div className="popup--buttons">
                            <button className="button open--confirm" onClick={onClick}>Resubmit</button>
                        </div>
                    </div>
                </> : <>
                        <Loading className="loading--blue" />
                        <div className="submitting-to-renvm--body">
                            <>
                                <p>Submitting order to RenVM...<br />This can take a few minutes.</p>
                                <p>Status: {<span>{renderTxStatus(renVMStatus)}</span> || <Loading className="loading--small" />}</p>
                            </>
                        </div>
                    </>
                }
            </div>
        </div>
    </Popup>;
};
