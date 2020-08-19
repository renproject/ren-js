import { Asset, Chain, LockAndMintEvent, Tx } from "@renproject/interfaces";
import { RenNetworkDetails } from "@renproject/contracts";
import { TokenIcon } from "@renproject/react-components";
import { extractError } from "@renproject/utils";
import { lighten } from "polished";
import React from "react";
import styled from "styled-components";

import { _catchInteractionErr_ } from "../../../lib/errors";
import { txPreview, txUrl } from "../../../lib/txUrl";
import {
    Container,
    ContainerBody,
    ContainerBottom,
    ContainerButtons,
    ContainerDetails,
    ContainerHeader,
} from "../../views/Container";
import { ErrorScreen } from "../../views/ErrorScreen";
import { ExternalLink } from "../../views/ExternalLink";
import { LabelledDiv } from "../../views/LabelledInput";
import { Mini } from "../../views/Mini";
import { TransparentButton, TransparentLoading } from "../../views/Styled";

const Title = styled.span`
    font-weight: 500;
    font-size: 20px;
    line-height: 23px;
    text-align: center;
    color: #3f3f48;
    opacity: 0.9;
`;

const StyledLink = styled.a`
    display: block;
    color: ${(p) => lighten(0.1, p.theme.primaryColor)} !important;
    border: 1px solid #ccc;
    border-radius: 6px;
    font-size: 14px !important;
    font-weight: 400 !important;
    letter-spacing: 0.2px;
    height: 40px;
    padding: 10px 0;
    width: 100%;
`;

interface Props {
    transfer: LockAndMintEvent;
    mini: boolean;
    txHash: Tx | null;
    networkDetails: RenNetworkDetails;
    token: Asset;
    submit: (retry?: boolean) => Promise<void>;
}

export const SubmitMintToEthereum: React.FC<Props> = ({
    transfer,
    mini,
    txHash,
    networkDetails,
    token,
    submit,
}) => {
    const [submitting, setSubmitting] = React.useState(false);
    const [error, setError] = React.useState(null as string | null);
    const [failedTransaction, setFailedTransaction] = React.useState(
        null as string | null,
    );

    // Monitor if the txHash has been cleared.
    const [previousTxHash, setPreviousTxHash] = React.useState<Tx | null>(null);
    React.useEffect(() => {
        if (txHash !== previousTxHash && previousTxHash && !txHash) {
            setSubmitting(false);
        }
        setPreviousTxHash(txHash);
    }, [previousTxHash, setPreviousTxHash, txHash]);

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
    }, [submit, error]);

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

    const amount =
        transfer.inTx &&
        transfer.inTx.chain !== Chain.Ethereum &&
        transfer.inTx.utxo &&
        transfer.inTx.utxo.amount
            ? transfer.inTx.utxo.amount
            : undefined;

    return (
        <Container>
            <div className="submit-to-ethereum">
                <ContainerBody>
                    <ContainerHeader icon={<TokenIcon token={token} />} />
                    <ContainerDetails>
                        {transfer.inTx ? (
                            <div className="submit-mint-to-ethereum--deposit">
                                <StyledLink
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    href={txUrl(transfer.inTx, networkDetails)}
                                >
                                    Tx ID: {txPreview(transfer.inTx)}
                                </StyledLink>
                            </div>
                        ) : (
                            <></>
                        )}
                    </ContainerDetails>
                </ContainerBody>
            </div>
            <ContainerBottom>
                {txHash ? (
                    <ExternalLink
                        className="no-underline"
                        href={txUrl(txHash, networkDetails)}
                    >
                        <LabelledDiv
                            style={{ textAlign: "center", maxWidth: "unset" }}
                            inputLabel="Transaction Hash"
                            width={125}
                            loading={true}
                        >
                            {txHash.chain === Chain.Ethereum
                                ? txHash.hash
                                : txHash.utxo
                                ? txHash.utxo.txHash
                                : txHash.address}
                        </LabelledDiv>
                    </ExternalLink>
                ) : (
                    <ContainerButtons>
                        <TransparentButton
                            className="button open--confirm"
                            disabled={submitting}
                            onClick={onSubmit}
                        >
                            Submit to Ethereum{" "}
                            {submitting ? (
                                <TransparentLoading alt={true} />
                            ) : (
                                ""
                            )}
                        </TransparentButton>
                    </ContainerButtons>
                )}
            </ContainerBottom>
        </Container>
    );
};
