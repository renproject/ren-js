import * as React from "react";

import { LockAndMintEvent, NetworkDetails, UTXOWithChain } from "@renproject/interfaces";
import { Loading, TokenIcon } from "@renproject/react-components";
import RenJS from "@renproject/ren";
import BigNumber from "bignumber.js";
import { OrderedMap } from "immutable";
import { lighten } from "polished";
import QRCode from "qrcode.react";
import CopyToClipboard from "react-copy-to-clipboard";
import styled from "styled-components";
import { extractError } from "@renproject/utils";

import { ReactComponent as QR } from "../../../images/qr.svg";
import { _catchInteractionErr_ } from "../../../lib/errors";
import { pulseAnimation } from "../../../scss/animations";
import { Token } from "../../../state/generalTypes";
import { getURL } from "../../controllers/Storage";
import { Popup } from "../Popup";
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


const QRCodeContainer = styled.div`
            background: #FFFFFF;
            border: 1px solid #DBE0E8;
            border-radius: 6px;
            display: inline-flex;
            padding: 10px;

            size: 110px;
            width: 132px;
            height: 132px;

            >canvas {
                height: 110px !important;
                width: 110px !important;
            }
            `;

const QRCodeOuter = styled.div`
            display: flex;
            flex-direction: column;
            align-items: center;

            >span {
                font-size: 1.4rem;
                color: #3F3F48;
                margin-top: 16px;
            }
`;

const StyledLabel = styled.span`
        color: ${p => lighten(0.1, p.theme.primaryColor)} !important;
        font-size: 14px !important;
        font-weight: 400 !important;
        letter-spacing: 0.2px;
        display: flex;
        justify-content: flex-start;
        margin-top: 3px;
        `;

const EllipsisSpan = styled.span`
    font-size: 1px;
    color: #00000000;
    margin-top: 14px;

    &:after {
        content: "...";
        font-size: 14px;
        display: block;
        margin-top: -14px;
        color: ${p => lighten(0.1, p.theme.primaryColor)} !important;
    }
        `;

const AddressControls = styled.div`
            display: flex;
            align-items: center;
            margin-right: 13px;

            button {
                padding: 0;
                min-width: 37px;
                padding: 0 5px;
                height: 20px;
                border-radius: 20px;
                // border: 1px solid ${p => p.theme.primaryColor};
                // background: rgba(0, 111, 232, 0.1);
                font-size: 1.0rem;
                line-height: 13px;
                position: absolute;
                border: 0;
                background: none;
                right: 20px;
                color: ${p => p.theme.primaryColor};
            }

            button + button {
                margin-left: 5px;
            }
        `;

const ContinueButton = styled.button`
            background: ${p => `linear-gradient(90deg, ${p.theme.primaryColor} 0%, ${lighten(0.1, p.theme.primaryColor)} 180%)`};
        `;

interface Props {
    mini: boolean;
    token: Token;
    generateAddress: () => Promise<string | undefined>;
    transferParams: LockAndMintEvent["transferParams"];
    utxos: OrderedMap<string, UTXOWithChain>;
    confirmations: number;
    sdkRenVM: RenJS | null;
    waitForDeposit(onDeposit: (utxo: UTXOWithChain) => void): Promise<void>;
    onDeposit(utxo: UTXOWithChain): void;
}

// Show Deposit Address
export const ShowGatewayAddress: React.StatelessComponent<Props> =
    ({ mini, token, utxos, transferParams, confirmations, generateAddress, waitForDeposit, onDeposit }) => {
        // Defaults for demo

        const [showQR, setShowQR] = React.useState(false);
        const [understood, setUnderstood] = React.useState(false);
        const [copied, setCopied] = React.useState(false);
        const [showSpinner, setShowSpinner] = React.useState(false);

        const [gatewayAddress, setGatewayAddress] = React.useState<string | null>(null);

        const onQRClick = (event: React.MouseEvent<HTMLButtonElement, MouseEvent>) => {
            event.stopPropagation();
            setShowQR(!showQR);
        };

        const [timer, setTimer] = React.useState<NodeJS.Timeout | null>(null);
        const [failed, setFailed] = React.useState<string | null>(null);

        const revealGatewayAddress = React.useCallback(() => {
            setTimer(setTimeout(() => {
                setShowSpinner(true);
            }, 5000) as any, // tslint:disable-line: no-any
            );
            setUnderstood(true);

            (async () => {
                const address = await generateAddress();
                setGatewayAddress(address || "");
                await waitForDeposit(onDeposit);
            })().catch(error => {
                setFailed(extractError(error));
                setUnderstood(false);
            });
        }, [waitForDeposit, onDeposit]);

        React.useEffect(() => {
            revealGatewayAddress();
        }, []); // tslint:disable-line: react-hooks/exhaustive-deps

        const onClickAddress = React.useCallback(() => {
            setCopied(true);
            if (timer) {
                clearTimeout(timer);
            }
            setTimer(setTimeout(() => {
                setCopied(false);
                if (!showSpinner) {
                    setShowSpinner(true);
                }
            }, 5000) as any, // tslint:disable-line: no-any
            );
        }, [showSpinner, timer]);

        const amount = transferParams.suggestedAmount ? new BigNumber(
            BigNumber.isBigNumber(transferParams.suggestedAmount) ? transferParams.suggestedAmount : transferParams.suggestedAmount.toString()
        ).div(new BigNumber(10).exponentiatedBy(8)).toFixed() : undefined; // TODO: decimals

        // const title = window.parent.document.title;
        const url = getURL();

        const urlDomain = (data: string) => {
            const a = document.createElement("a");
            a.href = data;
            return a.hostname;
        };

        const title = urlDomain(url);

        if (mini) {
            const last = utxos.last<UTXOWithChain>();
            return <Mini token={token} message={last ? `${last.utxo.confirmations} / ${confirmations} confirmations` : "Waiting for deposit"} />;
        }

        return <Popup mini={mini}>
            <div className="popup--body--details">
                {showQR && gatewayAddress ?
                    <QRCodeOuter>
                        <QRCodeContainer>
                            <QRCode value={`bitcoin:${gatewayAddress}${amount ? `?amount=${amount}` : ""}`} />
                        </QRCodeContainer>
                        <span>Deposit {amount ? amount : <></>} {token.toUpperCase()}</span>
                    </QRCodeOuter>
                    : <>
                        <div className="popup--token--icon"><TokenIcon token={token} /></div>
                        <div className="popup--body--title">
                            Deposit {amount ? amount : <></>} {token.toUpperCase()}
                        </div>
                        {/* <div className="popup--title--to">{sdkRenVM && sdkRenVM.network.isTestnet ? "(testnet)" : ""} to</div> */}
                        <div className="popup--title--to">to</div>
                    </>}
            </div>
            <div className="deposit-address">
                <div className="popup--body--actions">
                    {understood ?
                        <>
                            {/* <ScanningBanner>Scanning for transaction</ScanningBanner> */}
                            <CopyToClipboard
                                text={gatewayAddress || ""}
                                onCopy={onClickAddress}
                            >
                                <div role="button" className={`address-input--copy ${copied ? "address-input--copied" : ""}`}>
                                    <StyledLabel>{gatewayAddress ?
                                        <>
                                            {gatewayAddress.slice(0, 20) || ""}
                                            {gatewayAddress.slice(20, gatewayAddress.length - 20) ? <EllipsisSpan>{gatewayAddress.slice(20, gatewayAddress.length - 20) || ""}</EllipsisSpan> : <></>}
                                            {gatewayAddress.slice(Math.max(20, gatewayAddress.length - 20)) || ""}
                                        </> :
                                        <Loading />
                                    }</StyledLabel>
                                    <label className="copied-text">Copied</label>
                                    <AddressControls>
                                        <button onClick={onQRClick}><QR className="qr" /></button>
                                    </AddressControls>
                                </div>
                            </CopyToClipboard>
                            {/* {showQR ? <div className="qr-code"><QRCode value={`bitcoin:${gatewayAddress}?amount=${amount}`} /></div> : null} */}
                        </> :
                        <>
                            {failed ? <div className="center red">{failed}</div> : <></>}
                            <div className="popup--buttons">
                                <ContinueButton className="button" onClick={revealGatewayAddress}>Reveal deposit address</ContinueButton>
                            </div>
                        </>}
                </div>
            </div>
        </Popup>;
    };
