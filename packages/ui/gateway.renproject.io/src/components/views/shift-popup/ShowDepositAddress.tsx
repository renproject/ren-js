import * as React from "react";

import { Loading, TokenIcon } from "@renproject/react-components";
import { parseRenContract, UTXO } from "@renproject/ren";
import { Asset, ShiftInEvent } from "@renproject/ren-js-common";
import { OrderedMap } from "immutable";
import { lighten } from "polished";
import CopyToClipboard from "react-copy-to-clipboard";
import styled from "styled-components";

import infoIcon from "../../../images/icons/info.svg";
import { ReactComponent as QR } from "../../../images/qr.svg";
import { txUrl } from "../../../lib/txUrl";
import { pulseAnimation } from "../../../scss/animations";
import { Token, Tokens } from "../../../state/generalTypes";
import { LabelledInput } from "../LabelledInput";
import { Popup } from "../Popup";
import { Tooltip } from "../tooltip/Tooltip";

const ScanningBanner: React.FC<{}> = props => {
    const ScanningDot = styled.span`
            height: 10px;
            width: 10px;
            background-color: ${p => lighten(0.1, p.theme.primaryColor)};
            border-radius: 50%;
            display: block;
            margin-right: 10px;
            animation: ${p => pulseAnimation("6px", p.theme.primaryColor)};
            line-height: 100%;
        `;

    const ScanningDiv = styled.div`
            font-size: 13.44px;
            color: ${p => p.theme.lightGrey};
            display: flex;
            justify-content: center;
            align-items: center;
            padding: 40px 0;
        `;

    const ScanningText = styled.span`
            min-width: 170px;
            line-height: 100%;
        `;
    return (
        <ScanningDiv><ScanningDot /><ScanningText className="ellipsis">{props.children}</ScanningText></ScanningDiv>
    );
};

const INTEROP_LINK = "#";

interface Props {
    mini: boolean;
    token: Token;
    depositAddress: string;
    order: ShiftInEvent;
    utxos: OrderedMap<string, UTXO>;
    onQRClick(): void;
    waitForDeposit(onDeposit: (utxo: UTXO) => void): Promise<void>;
    onDeposit(utxo: UTXO): void;
}

export const ShowDepositAddress: React.StatelessComponent<Props> =
    ({ mini, token, order, utxos, onQRClick, depositAddress, waitForDeposit, onDeposit }) => {
        // Defaults for demo

        // tslint:disable-next-line: prefer-const
        let [understood, setUnderstood] = React.useState(false);
        const [copied, setCopied] = React.useState(false);
        const [showSpinner, setShowSpinner] = React.useState(false);

        const [timer, setTimer] = React.useState<NodeJS.Timeout | null>(null);
        const [failed, setFailed] = React.useState(null as Error | null);

        const showDepositAddress = React.useCallback(() => {

            setTimer(setTimeout(() => {
                setShowSpinner(true);
            }, 5000) as any, // tslint:disable-line: no-any
            );
            setUnderstood(true);
            understood = true;
            waitForDeposit(onDeposit)
                .catch((error) => {
                    setFailed(error);
                });
        }, [waitForDeposit, onDeposit]);

        React.useEffect(() => {
            showDepositAddress();
        }, []);

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
        }, []);

        const ContinueButton = styled.button`
            background: ${p => `linear-gradient(90deg, ${p.theme.primaryColor} 0%, ${lighten(0.1, p.theme.primaryColor)} 180%)`};
        `;

        const DepositLabel = styled.label`
        position: absolute;
        top: 0;
        width: 200px;
        text-align: center;
        margin-left: 100px;
        font-size: 14px;
        color: ${p => p.theme.lightGrey};
        background-color: white;
        margin-top: -10px;
        `;

        const StyledInput = styled.input`
        color: ${p => lighten(0.1, p.theme.primaryColor)} !important;
        font-size: 14px !important;
        font-weight: 400 !important;
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
                border: 1px solid ${p => p.theme.primaryColor};
                background: rgba(0, 111, 232, 0.1);
                font-size: 10px;
                line-height: 13px;
                color: ${p => p.theme.primaryColor};
            }

            button + button {
                margin-left: 5px;
            }
        `;

        const tokenDetails = Tokens.get(token);
        const showAddress = understood ?
            <>
                <ScanningBanner>Scanning for transaction</ScanningBanner>
                <div role="button" className={`address-input--copy ${copied ? "address-input--copied" : ""}`}>
                    <StyledInput
                        type="text"
                        name="address"
                        disabled={true}
                        value={depositAddress || ""}
                        autoFocus={true}
                        required={true}
                        aria-required={true}
                    />
                    <DepositLabel>{tokenDetails && tokenDetails.name} Deposit Address</DepositLabel>
                    <label className="copied-text">Copied</label>
                    <AddressControls>
                        <button onClick={onQRClick}><QR className="qr" /></button>
                        <CopyToClipboard
                            text={depositAddress || ""}
                            onCopy={onClickAddress}
                        >
                            <button>{copied ? "Copied" : "Copy"}</button>
                        </CopyToClipboard>
                    </AddressControls>
                </div>
                {/* {showQR ? <div className="qr-code"><QRCode value={`bitcoin:${depositAddress}?amount=${amount}`} /></div> : null} */}
            </> :
            <>
                {failed ? <div className="red">{`${failed.message || failed}`}</div> :
                    <div className="popup--body--box">
                        <div className="popup--body--box--title">
                            Transfer {token.toUpperCase()} trustlessly.
                        </div>
                        Your {token.toUpperCase()} will be bridged to Ethereum in a completely trustless and decentralized way. Read more about RenVM and sMPC <a href="https://renproject.io/#TODO">here</a>.
                    </div>
                }
                <div className="popup--buttons">
                    <ContinueButton className="button" disabled={depositAddress as string | null === null || failed !== null} onClick={showDepositAddress}>{failed ? "Unable to generate address" : "Continue"}</ContinueButton>
                </div>
            </>;

        const ConfirmationsContainer = styled.div`
        text-align: center;
        `;
        const ConfirmationsHeader = styled.span`
        font-size: 14px;
        margin-right: 5px;
        color: #87888C;
        `;

        const ConfirmationsCount = styled.span`
        margin-left: 10px;
        `;
        const ConfirmationsBlock = styled.div`
        display: flex;
        justify-content: center;
        align-items: center;
        padding: 10px 0;
        margin-bottom: 20px;
        `;

        const tooltipText = `Waiting for confirmations. This can take up to twenty minutes due to confirmation times on various blockchains. This will be improved for Mainnet via 3rd parties.`;

        const showUTXOs = (
            utxos.size > 0 ? <div className="show-utxos">
                <ConfirmationsContainer>
                    <ConfirmationsHeader>Confirmations</ConfirmationsHeader>
                    {/* tslint:disable-next-line: react-a11y-anchors */}
                    <Tooltip width={250} contents={<span>{tooltipText} For more information, head <a className="blue" href={INTEROP_LINK} target="_blank" rel="noopener noreferrer">here</a>.</span>}><img alt={tooltipText} src={infoIcon} /></Tooltip>
                </ConfirmationsContainer>
                {utxos.map(utxo => {
                    return <div key={utxo.utxo.txid}>
                        {/* <div className="show-utxos--utxo">
                        <a href={txUrl({ chain: utxo.chain, hash: utxo.utxo.txid })} target="_blank" rel="noopener noreferrer">TXID {hash}</a>
                    </div> */}
                        <ConfirmationsBlock>
                            <Loading className="loading--blue" />
                            <ConfirmationsCount>{utxo.utxo.confirmations} / {order ? (parseRenContract(order.shiftParams.sendToken).asset === Asset.ZEC ? 6 : 2) : "?"} confirmations</ConfirmationsCount>
                        </ConfirmationsBlock>
                        <a href={txUrl({ chain: utxo.chain, hash: utxo.utxo.txid })}><LabelledInput style={{ textAlign: "center", maxWidth: "unset" }} type="text" inputLabel="Transaction ID" width={105} value={utxo.utxo.txid} disabled={true} /></a>
                    </div>;
                }).valueSeq()}
                {/* <details>
                    <summary>Show deposit address</summary>
                    {showAddress}
                </details> */}
            </div> : null
        );

        if (mini) {
            const last = utxos.last<UTXO>();
            return <Popup mini={mini}>
                <div className="side-strip"><TokenIcon token={token} /></div>
                <div className="popup--body--details">
                    {last ? <>{last.utxo.confirmations} / {(parseRenContract(order.shiftParams.sendToken).asset === Asset.ZEC ? 6 : 2)} confirmations</> : <>Waiting for deposit</>}
                </div>
            </Popup>;
        }

        return <Popup mini={mini}>
            <div className="deposit-address">
                <div className="popup--body--actions">
                    {utxos.size > 0 ? showUTXOs : showAddress}
                </div>
            </div>
        </Popup>;
    };
