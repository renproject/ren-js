import * as React from "react";

import { LockAndMintEvent, NetworkDetails, UTXOWithChain } from "@renproject/interfaces";
import { TokenIcon } from "@renproject/react-components";
import RenJS from "@renproject/ren";
import BigNumber from "bignumber.js";
import { OrderedMap } from "immutable";
import { lighten } from "polished";
import QRCode from "qrcode.react";
import CopyToClipboard from "react-copy-to-clipboard";
import styled from "styled-components";

import { ReactComponent as QR } from "../../../images/qr.svg";
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

interface Props {
    mini: boolean;
    token: Token;
    depositAddress: string;
    order: LockAndMintEvent;
    transferParams: LockAndMintEvent["transferParams"];
    utxos: OrderedMap<string, UTXOWithChain>;
    networkDetails: NetworkDetails;
    confirmations: number;
    sdkRenVM: RenJS | null;
    onQRClick(): void;
    waitForDeposit(onDeposit: (utxo: UTXOWithChain) => void): Promise<void>;
    onDeposit(utxo: UTXOWithChain): void;
}


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

export const ShowDepositAddress: React.StatelessComponent<Props> =
    ({ mini, token, order, utxos, sdkRenVM, transferParams, confirmations, depositAddress, waitForDeposit, onDeposit, networkDetails }) => {
        // Defaults for demo

        const [showQR, setShowQR] = React.useState(false);
        const [understood, setUnderstood] = React.useState(false);
        const [copied, setCopied] = React.useState(false);
        const [showSpinner, setShowSpinner] = React.useState(false);

        const onQRClick = (event: React.MouseEvent<HTMLButtonElement, MouseEvent>) => {
            event.stopPropagation();
            setShowQR(!showQR);
        };

        const [timer, setTimer] = React.useState<NodeJS.Timeout | null>(null);
        const [failed, setFailed] = React.useState(null as Error | null);

        const showDepositAddress = React.useCallback(() => {

            setTimer(setTimeout(() => {
                setShowSpinner(true);
            }, 5000) as any, // tslint:disable-line: no-any
            );
            setUnderstood(true);
            waitForDeposit(onDeposit)
                .catch((error) => {
                    setFailed(error);
                });
        }, [waitForDeposit, onDeposit]);

        React.useEffect(() => {
            showDepositAddress();
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
                {showQR && depositAddress ?
                    <QRCodeOuter>
                        <QRCodeContainer>
                            <QRCode value={`bitcoin:${depositAddress}${amount ? `?amount=${amount}` : ""}`} />
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
                                text={depositAddress || ""}
                                onCopy={onClickAddress}
                            >
                                <div role="button" className={`address-input--copy ${copied ? "address-input--copied" : ""}`}>
                                    <StyledLabel>{depositAddress || ""}</StyledLabel>
                                    <label className="copied-text">Copied</label>
                                    <AddressControls>
                                        <button onClick={onQRClick}><QR className="qr" /></button>
                                    </AddressControls>
                                </div>
                            </CopyToClipboard>
                            {/* {showQR ? <div className="qr-code"><QRCode value={`bitcoin:${depositAddress}?amount=${amount}`} /></div> : null} */}
                        </> :
                        <>
                            {failed ? <div className="red">{`${failed.message || failed}`}</div> : <></>}
                            <div className="popup--buttons">
                                <ContinueButton className="button" disabled={depositAddress as string | null === null || failed !== null} onClick={showDepositAddress}>{failed ? "Unable to generate address" : "Continue"}</ContinueButton>
                            </div>
                        </>}
                </div>
            </div>
        </Popup>;
    };
