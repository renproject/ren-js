import { RenNetworkDetails } from "@renproject/contracts";
import { Asset, Chain, LockAndMintEvent, Tx } from "@renproject/interfaces";
import { TokenIcon } from "@renproject/react-components";
import { extractError } from "@renproject/utils";
import BigNumber from "bignumber.js";
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

const StyledLink = styled.a`
    display: block;
    color: #515159;
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
    onLoad: () => Promise<void>;
    onLoadAsync: () => Promise<void>;
}

export const SubmitMintToEthereum: React.FC<Props> = ({
    transfer,
    mini,
    txHash,
    networkDetails,
    token,
    submit,
    onLoad,
    onLoadAsync,
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
    const [ready, setReady] = React.useState(false);
    React.useEffect(() => {
        if (!initialized) {
            setInitialized(true);
            if (txHash) {
                onSubmit().catch(console.error);
            } else {
                onLoad()
                    .then(() => {
                        setReady(true);
                    })
                    .catch((err) => {
                        setReady(true);
                        console.error(err);
                    });
                onLoadAsync().catch(console.error);

                // If onLoad doesn't complete within 1 minute, set ready anyway.
                setTimeout(() => {
                    setReady(true);
                }, 60 * 1000);
            }
        }
    }, [initialized, txHash, onSubmit, onLoad, onLoadAsync, ready, setReady]);

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
        transfer &&
        transfer.inTx &&
        transfer.inTx.chain !== Chain.Ethereum &&
        transfer.inTx.utxo &&
        // If amount is zero - it may because RenJS isn't fetching the full UTXO details.
        transfer.inTx.utxo.amount
            ? new BigNumber(transfer.inTx.utxo.amount)
            : undefined;

    const amountReadable = amount
        ? new BigNumber(amount)
              .div(new BigNumber(10).exponentiatedBy(8)) // TODO: decimals
              .toFixed()
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
                                    {amountReadable ? (
                                        <>{amountReadable}</>
                                    ) : (
                                        "Received"
                                    )}{" "}
                                    {token.toUpperCase()}
                                    {" - "}
                                    <span className="blue">
                                        {txPreview(transfer.inTx)}
                                    </span>
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
                            disabled={submitting || !ready}
                            onClick={onSubmit}
                        >
                            {ready ? <>Submit to Ethereum </> : null}
                            {submitting || !ready ? (
                                <TransparentLoading alt={true} />
                            ) : null}
                        </TransparentButton>
                    </ContainerButtons>
                )}
            </ContainerBottom>
        </Container>
    );
};
