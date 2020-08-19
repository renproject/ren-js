import { Asset, TxStatus } from "@renproject/interfaces";
import { Loading } from "@renproject/react-components";
import { lighten } from "polished";
import React from "react";
import styled from "styled-components";

import { _catchInteractionErr_ } from "../../../lib/errors";
import { ReactComponent as BurnIcon } from "../../../scss/images/burn.svg";
import {
    Container, ContainerBody, ContainerBottom, ContainerButtons, ContainerHeader,
} from "../../views/Container";
import { Mini } from "../../views/Mini";
import { TransparentButton, TransparentLoading } from "../../views/Styled";

const renderTxStatus = (status: TxStatus | null) => {
    switch (status) {
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
        default:
            return "Submitting";
    }
};

interface Props {
    mini: boolean;
    token: Asset;
    txHash: string | null;
    renVMStatus: TxStatus | null;
    submitDeposit: () => Promise<unknown>;
}

export const SubmitBurnToRenVM: React.FC<Props> = ({ mini, token, renVMStatus, txHash, submitDeposit }) => {
    const [error, setError] = React.useState(null as Error | null);
    const [submitting, setSubmitting] = React.useState(true);

    const onClick = React.useCallback(async () => {
        setError(null);
        setSubmitting(true);
        if (submitDeposit) {
            try {
                await submitDeposit();
            } catch (error) {
                setError(error);
                _catchInteractionErr_(error, "Error in DepositReceived: submitDeposit");
                setSubmitting(false);
            }
        }
    }, [submitDeposit]);

    // useEffect replaces `componentDidMount` and `componentDidUpdate`.
    // To limit it to running once, we use the initialized hook.
    const [initialized, setInitialized] = React.useState(false);
    React.useEffect(() => {
        if (!initialized) {
            setInitialized(true);
            // if (txHash) {
            onClick().catch(console.error);
            // }
        }
    }, [initialized, txHash, onClick]);

    if (mini) {
        return <Mini token={token} message={submitting ? "Submitting to RenVM" : "Submit to RenVM"} />;
    }

    return <Container>
        <div className="burn-container submit-to-ethereum">
            <ContainerBody>
                <ContainerHeader icon={<BurnIcon />} />
                <div className="container--body--message">
                    {/* {token ? <TokenIcon className="token-icon" token={token} /> : null} */}
                    {submitting ? <>Status: {renderTxStatus(renVMStatus)}</> : <></>}
                    {error ? <>
                        <div className="submitting-to-renvm--body">
                            <p style={{ marginTop: "20px", fontSize: "16px" }} className="red">Unable to submit to RenVM</p>
                            <p style={{ lineBreak: "anywhere" }} className="red">{error.message || error}</p>
                        </div>
                    </> : <></>}
                </div>
            </ContainerBody>
        </div>
        <ContainerBottom>
            <ContainerButtons>
                <TransparentButton className="button open--confirm" disabled={submitting} onClick={onClick}>
                    {submitting ? <>Submitting to RenVM <TransparentLoading alt={true} /></> : <>Submit to RenVM</>}
                </TransparentButton>
            </ContainerButtons>
        </ContainerBottom>
    </Container>;
};
