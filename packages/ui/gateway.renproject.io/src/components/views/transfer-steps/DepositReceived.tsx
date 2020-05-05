import * as React from "react";

import { NetworkDetails, UTXOWithChain } from "@renproject/interfaces";
import { extractError } from "@renproject/utils";
import { OrderedMap } from "immutable";
import { lighten } from "polished";
import styled from "styled-components";

import infoIcon from "../../../images/icons/info.svg";
import { _catchInteractionErr_ } from "../../../lib/errors";
import { txPreview, txUrl } from "../../../lib/txUrl";
import { range } from "../../../lib/utils";
import { pulseAnimation } from "../../../scss/animations";
import { Token } from "../../../state/generalTypes";
import { Container } from "../Container";
import { ProgressBar } from "../ProgressBar";
import { Tooltip } from "../tooltip/Tooltip";
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
    token: Token;
    utxos: OrderedMap<string, UTXOWithChain>;
    networkDetails: NetworkDetails;
    confirmations: number;
    waitForDeposit(onDeposit: (utxo: UTXOWithChain) => void): Promise<void>;
    onDeposit(utxo: UTXOWithChain): void;
}

const ConfirmationsContainer = styled.div`
        text-align: center;
        `;
const ConfirmationsHeader = styled.span`
        font-size: 1.4rem;
        margin-right: 5px;
        color: #87888C;
        `;

const ConfirmationsBlock = styled.div`
        display: flex;
        justify-content: center;
        align-items: center;
        margin-bottom: 20px;
        `;

const StyledLabel = styled.span`
        color: ${p => lighten(0.1, p.theme.primaryColor)} !important;
        font-size: 14px !important;
        font-weight: 400 !important;
        letter-spacing: 0.2px;
        `;

export const DepositReceived: React.StatelessComponent<Props> =
    ({ mini, token, utxos, confirmations, waitForDeposit, onDeposit, networkDetails }) => {
        // Defaults for demo

        const [failed, setFailed] = React.useState(null as string | null);
        const [showFullError, setShowFullError] = React.useState(false);
        const toggleShowFullError = React.useCallback(() => { setShowFullError(!showFullError); }, [showFullError, setShowFullError]);

        const waitAndSubmitDeposit = React.useCallback(() => {
            setShowFullError(false);
            waitForDeposit(onDeposit)
                .catch((error) => {
                    _catchInteractionErr_(error, "Error in DepositReceived: waitAndSubmitDeposit");
                    setFailed(extractError(error));
                });
        }, [waitForDeposit, onDeposit]);

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

        const tooltipText = `Waiting for confirmations. This can take up to twenty minutes due to confirmation times on various blockchains.`;

        if (mini) {
            const last = utxos.last<UTXOWithChain>();
            return <Mini token={token} message={last ? `${last.utxo.confirmations} / ${confirmations} confirmations` : "Waiting for deposit"} />;
        }

        return <Container mini={mini}>
            <div className="container--body--details deposit-received">
                <div className="container--body--actions">
                    {failed ?
                        <div className="ethereum-error red">
                            <p>Error waiting for deposit: {!showFullError && failed.length > 100 ? <>{failed.slice(0, 100)}...{" "}<span role="button" className="link" onClick={toggleShowFullError}>See more</span></> : failed}</p>
                            <button className="button" onClick={waitAndSubmitDeposit}>Retry</button>
                        </div> : <>
                            {confirmations ? <ConfirmationsContainer>
                                <ConfirmationsHeader>Confirmations</ConfirmationsHeader>
                                {/* tslint:disable-next-line: react-a11y-anchors */}
                                <Tooltip width={250} contents={<span>{tooltipText}</span>/* Read about confirmationless deposits <a className="blue" href={INTEROP_LINK} target="_blank" rel="noopener noreferrer">here</a>.</span>*/}><img alt={tooltipText} src={infoIcon} /></Tooltip>
                            </ConfirmationsContainer> : <></>}
                            {utxos.map(utxo => {
                                return <div key={utxo.utxo.txHash}>
                                    {/* <div className="show-utxos--utxo">
                        <a href={txUrl({ chain: utxo.chain, hash: utxo.utxo.txid })} target="_blank" rel="noopener noreferrer">TXID {hash}</a>
                    </div> */}
                                    {confirmations ? <ConfirmationsBlock>
                                        <ProgressBar
                                            className="confirmation--progress"
                                            style={{ width: `${confirmations <= 1 ? 50 : 100}%` }}
                                            items={[
                                                ...range(confirmations).map(i => ({})),
                                                { label: "✓" }
                                            ]}
                                            progress={utxo.utxo.confirmations}
                                            pulse={true}
                                        />
                                        {/* {range(order ? 7 : 1).map(target =>
                                <ProgressItem target={target + 1} progress={utxo.utxo.confirmations} />
                            )} */}
                                        {/* <Loading className="loading--blue" /> */}
                                        {/* <ConfirmationsCount>{utxo.utxo.confirmations} / {confirmations} confirmations</ConfirmationsCount> */}
                                    </ConfirmationsBlock> : <></>}
                                </div>;
                            }).valueSeq()}
                        </>}
                </div>
            </div>
            <div className="deposit-address">
                <div className="container--body--actions">
                    {utxos.map(utxo => {
                        return <div key={utxo.utxo.txHash}>
                            <a target="_blank" rel="noopener noreferrer" className="no-underline" href={txUrl(utxo, networkDetails)}>
                                <div role="button" className={`address-input--copy`}>
                                    <StyledLabel>Tx ID: {txPreview(utxo)}</StyledLabel>
                                </div>
                            </a>
                        </div>;
                    }).valueSeq()}
                </div>
            </div>
        </Container>;
    };
