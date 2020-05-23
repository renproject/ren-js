import * as React from "react";

import { RenNetworkDetails } from "@renproject/contracts";
import { Asset, UTXOWithChain } from "@renproject/interfaces";
import { extractError } from "@renproject/utils";
import { OrderedMap } from "immutable";
import { lighten } from "polished";
import styled from "styled-components";
import { TokenIcon } from "@renproject/react-components";

import { ReactComponent as AlertIcon } from "../../../images/alert.svg";
import infoIcon from "../../../images/icons/info.svg";
import { _catchInteractionErr_ } from "../../../lib/errors";
import { txPreview, txUrl } from "../../../lib/txUrl";
import { range } from "../../../lib/utils";
import { pulseAnimation } from "../../../scss/animations";
import {
    Container, ContainerBody, ContainerBottom, ContainerDetails, ContainerHeader,
} from "../Container";
import { ExternalLink } from "../ExternalLink";
import { ProgressBar } from "../ProgressBar";
import { Tooltip } from "../tooltip/Tooltip";
import { ErrorScreen } from "./ErrorScreen";
import { Mini } from "./Mini";

export const ScanningDot = styled.span`
            height: 10px;
            width: 10px;
            background-color: ${p => lighten(0.1, p.theme.primaryColor)};
            border-radius: 50%;
            display: block;
            margin-right: 10px;
            animation: ${p => pulseAnimation("6px", p.theme.primaryColor)};
            line-height: 100%;
            flex-shrink: 0;
        `;

interface Props {
    mini: boolean;
    token: Asset;
    utxos: OrderedMap<string, UTXOWithChain>;
    networkDetails: RenNetworkDetails;
    confirmations: number;
    waitForDeposit(onDeposit: (utxo: UTXOWithChain) => void): Promise<void>;
    onDeposit(utxo: UTXOWithChain): void;
    requestNotificationPermission(): Promise<{
        error?: string | undefined;
    } | null>;
    showNotification(title: string, body: string): Promise<null>;
}

const ConfirmationsContainer = styled.div`
        text-align: center;
        `;
const ConfirmationsHeader = styled.span`
        font-size: 1.4rem;
        margin-right: 5px;
        color: #3F3F48;
        `;

const ConfirmationsBlock = styled.div`
        display: flex;
        justify-content: center;
        align-items: center;
        `;

const StyledLabel = styled.span`
        color: ${p => lighten(0.1, p.theme.primaryColor)} !important;
        font-size: 14px !important;
        font-weight: 400 !important;
        letter-spacing: 0.2px;
        `;

export const DepositReceived: React.StatelessComponent<Props> =
    ({ mini, token, utxos, confirmations, waitForDeposit, onDeposit, networkDetails, requestNotificationPermission, showNotification }) => {
        // Defaults for demo

        const [failed, setFailed] = React.useState(null as string | null);
        const [showFullError, setShowFullError] = React.useState(false);
        const toggleShowFullError = React.useCallback(() => { setShowFullError(!showFullError); }, [showFullError, setShowFullError]);

        const waitAndSubmitDeposit = React.useCallback(() => {
            setShowFullError(false);
            (async () => {
                try {
                    requestNotificationPermission().catch(console.error);
                    const beforeDeposit = (new Date()).getTime() / 1000;
                    await waitForDeposit(onDeposit);
                    const afterDeposit = (new Date()).getTime() / 1000;

                    // Check if waiting for the deposit took longer than 30
                    // seconds. This is to avoid showing a notification if the
                    // user had the window closed when the TX was confirmed and
                    // has just reopened the window.
                    const secondsWaited = afterDeposit - beforeDeposit;
                    if (secondsWaited >= 30) {
                        // tslint:disable-next-line: insecure-random
                        showNotification(`${token.toUpperCase()} Deposit Confirmed`, `Click to resume transfer`).catch(console.error);
                    }
                } catch (error) {
                    _catchInteractionErr_(error, "Error in DepositReceived: waitAndSubmitDeposit");
                    setFailed(extractError(error));
                }
            })().catch(console.error);
        }, [waitForDeposit, onDeposit, requestNotificationPermission, showNotification, token]);

        React.useEffect(() => {
            waitAndSubmitDeposit();
            // eslint-disable-next-line react-hooks/exhaustive-deps
        }, []);

        // const onClickAddress = React.useCallback(() => {
        //     setCopied(true);
        //     if (timer) {
        //         clearTimeout(timer);
        //     }
        //     setTimer(setTimeout(() => {
        //         setCopied(false);
        //         if (!showSpinner) {
        //             setShowSpinner(true);
        //         }
        //     }, 5000) as any, // tslint:disable-line: no-any
        //     );
        // }, [showSpinner, timer]);

        const tooltipText = `Waiting for ${confirmations} confirmations. This can take up to ${networkDetails.isTestnet ? "twenty minutes" : "an hour"} due to ${token.toUpperCase()} confirmation times.`;

        const firstUTXO = utxos.first<UTXOWithChain>();

        if (mini) {
            return <Mini
                token={token}
                message={firstUTXO ?
                    firstUTXO.utxo.confirmations >= confirmations ?
                        "Deposit confirmed" :
                        `${firstUTXO.utxo.confirmations} / ${confirmations} confirmations` :
                    "Waiting for deposit"}
            />;
        }

        // Currently, only the first UTXO is considered.
        utxos = utxos.slice(0, 1);

        if (failed) {
            return <ErrorScreen
                errorTitle={firstUTXO ?
                    <>Error processing deposit <ExternalLink className="no-underline" href={txUrl(firstUTXO, networkDetails)}>{txPreview(firstUTXO, 10)}</ExternalLink></> :
                    <>Error waiting for deposit</>
                }
                errorMessage={failed}
                retryMessage={<>Retry</>}
                retry={waitAndSubmitDeposit}
            />;
        }

        return <Container mini={mini}>
            <ContainerBody>
                <ContainerHeader icon={<TokenIcon token={token} />} />
                <ContainerDetails className="deposit-received">

                    {confirmations ? <ConfirmationsContainer>
                        <ConfirmationsHeader>Confirmations</ConfirmationsHeader>
                        {/* tslint:disable-next-line: react-a11y-anchors */}
                        <Tooltip direction={"bottom"} width={250} contents={<span>{tooltipText}</span>/* Read about confirmationless deposits <ExternalLink className="blue" href={INTEROP_LINK}>here</ExternalLink>.</span>*/}><img alt={tooltipText} src={infoIcon} /></Tooltip>
                    </ConfirmationsContainer> : <></>}
                    {utxos.map(utxo => {
                        return <div className="confirmation--progress--container" key={utxo.utxo.txHash}>
                            {/* <div className="show-utxos--utxo">
                                        <ExternalLink href={txUrl({ chain: utxo.chain, hash: utxo.utxo.txid })}>TXID {hash}</ExternalLink>
                                    </div> */}
                            {confirmations ? <ConfirmationsBlock>
                                {confirmations >= 10 ? <ProgressBar
                                    className="confirmation--progress"
                                    style={{ width: `${confirmations <= 1 ? 50 : 100}%` }}
                                    items={[
                                        ...range(Math.ceil(confirmations / 2)).map(i => ({ label: String(i * 2 + 1) })),
                                        { label: "✓" }
                                    ]}
                                    progress={utxo.utxo.confirmations / 2}
                                    pulse={true}
                                /> : <ProgressBar
                                        className="confirmation--progress"
                                        style={{ width: `${confirmations <= 1 ? 50 : 100}%` }}
                                        items={[
                                            ...range(confirmations).map(_ => ({})),
                                            { label: "✓" }
                                        ]}
                                        progress={utxo.utxo.confirmations}
                                        pulse={true}
                                    />}
                                {/* {range(order ? 7 : 1).map(target =>
                                <ProgressItem target={target + 1} progress={utxo.utxo.confirmations} />
                            )} */}
                                {/* <Loading className="loading--blue" /> */}
                                {/* <ConfirmationsCount>{utxo.utxo.confirmations} / {confirmations} confirmations</ConfirmationsCount> */}
                            </ConfirmationsBlock> : <></>}
                        </div>;
                    }).valueSeq()}
                </ContainerDetails>
            </ContainerBody>
            <ContainerBottom>
                {utxos.map(utxo => {
                    return <div key={utxo.utxo.txHash}>
                        <ExternalLink className="no-underline" href={txUrl(utxo, networkDetails)}>
                            <div role="button" className={`click-to-copy`}>
                                <StyledLabel>Tx ID: {txPreview(utxo)}</StyledLabel>
                                {/* <StyledLabel>{utxo.utxo && utxo.utxo.amount > 0 ? <>Tx: {renderAmount(utxo)} - </> : <>Tx ID:</>} {txPreview(utxo)}</StyledLabel> */}
                            </div>
                        </ExternalLink>
                    </div>;
                }).valueSeq()}
            </ContainerBottom>
        </Container>;
    };
