import * as React from "react";

import { TokenIcon } from "@renproject/react-components";
import {
    DetailedContractCall, ShiftInEvent, ShiftInStatus, ShiftOutEvent, ShiftOutStatus,
} from "@renproject/ren-js-common";
import BigNumber from "bignumber.js";
import QRCode from "qrcode.react";
import CopyToClipboard from "react-copy-to-clipboard";
import styled from "styled-components";

import infoIcon from "../../images/icons/info.svg";
import { isPromise, _catchInteractionErr_ } from "../../lib/errors";
import { GatewayMessageType, postMessageToClient } from "../../lib/postMessage";
import { connect, ConnectedProps } from "../../state/connect";
import { Token } from "../../state/generalTypes";
import { SDKContainer } from "../../state/sdkContainer";
import { UIContainer } from "../../state/uiContainer";
import { getURL } from "../controllers/Storage";
import { LogIn } from "../views/LogIn";
import { AskForAddress } from "../views/shift-popup/AskForAddress";
import { Complete } from "../views/shift-popup/Complete";
import { DepositReceived } from "../views/shift-popup/DepositReceived";
import { ShowDepositAddress } from "../views/shift-popup/ShowDepositAddress";
import { SubmitToEthereum } from "../views/shift-popup/SubmitToEthereum";
import { Tooltip } from "../views/tooltip/Tooltip";

interface Props extends ConnectedProps<[UIContainer, SDKContainer]> {
}

const getRequiredAddressAndName = (shiftParams: ShiftInEvent["shiftParams"] | ShiftOutEvent["shiftParams"]) => shiftParams.contractCalls ? Array.from(shiftParams.contractCalls).reduce((accOuter, contractCall) => {
    if (accOuter !== null || isPromise(contractCall)) { return accOuter; }
    return (contractCall.contractParams || []).reduce((acc, param) => {
        if (acc !== null || !param || typeof param.value !== "string") { return acc; }
        const match = param.value.match(/^__renAskForAddress__([a-zA-Z0-9]+)?$/);
        return match ? [param.name, match] : null;
    }, null as [string, RegExpMatchArray] | null);
}, null as [string, RegExpMatchArray] | null) as [string, RegExpMatchArray] | null : null;

/**
 * OpeningShift is a visual component for allowing users to open new shifts
 */
export const OpeningShift = connect<Props & ConnectedProps<[UIContainer, SDKContainer]>>([UIContainer, SDKContainer])(
    ({ containers: [uiContainer, sdkContainer] }) => {

        const [showQR, setShowQR] = React.useState(false);
        // tslint:disable-next-line: prefer-const
        let [returned, setReturned] = React.useState(false);

        const toggleShowQR = React.useCallback(() => setShowQR(!showQR), [showQR]);

        const onDone = async () => {
            if (returned) {
                return;
            }
            returned = true;
            setReturned(true);
            if (uiContainer.state.gatewayPopupID) {
                postMessageToClient(window, uiContainer.state.gatewayPopupID, GatewayMessageType.Done, {});
            }
            uiContainer.resetTrade().catch((error) => _catchInteractionErr_(error, "Error in OpeningShift: onDone > resetTrade"));
        };

        const { sdkRenVM, shift } = sdkContainer.state;

        if (!shift) {
            throw new Error(`Unable to load shift details`);
        }

        const { paused, utxos } = uiContainer.state;

        const AmountSpan = styled.span`
                color: ${props => props.theme.primaryColor};
                cursor: pointer;
            `;

        const QRCodeContainer = styled.div`
            background: #FFFFFF;
            border: 1px solid #DBE0E8;
            border-radius: 6px;
            display: inline-flex;
            padding: 15px;
            `;

        const ParentContainer = styled.div`
            display: flex;
            align-content: center;
            align-items: center;
            `;

        const ParentInfo = styled.span`
            font-size: 18px;
            margin: 0 5px;
            & > img {
                margin: 0 5px;
            }
                        .address {
                font-size: 14px;
            }
            `;

        // const title = window.parent.document.title;
        const url = getURL();

        const urlDomain = (data: string) => {
            const a = document.createElement("a");
            a.href = data;
            return a.hostname;
        };

        const title = urlDomain(url);

        const shiftIn = () => {

            const shiftParams = shift.shiftParams as ShiftInEvent["shiftParams"];

            const token = shiftParams.sendToken.slice(0, 3) as Token;

            const amount = shiftParams.sendAmount ? new BigNumber(
                BigNumber.isBigNumber(shiftParams.sendAmount) ? shiftParams.sendAmount : shiftParams.sendAmount.toString()
            ).div(new BigNumber(10).exponentiatedBy(8)).toFixed() : undefined; // TODO: decimals

            let depositAddress;

            let inner = <></>;
            if (!sdkRenVM) {
                inner = <LogIn token={token} paused={paused} wrongNetwork={uiContainer.state.wrongNetwork} />;
            } else {
                switch (shift.status) {
                    case ShiftInStatus.Committed:
                    case ShiftInStatus.Deposited:
                        // tslint:disable-next-line: no-unnecessary-type-assertion
                        const requiredAddressAndName = getRequiredAddressAndName(shiftParams);
                        if (requiredAddressAndName !== null) {
                            const [variableName, requiredAddress] = requiredAddressAndName;
                            const requestedToken = requiredAddress[1] as Token || token;
                            inner = <AskForAddress
                                mini={paused}
                                key={requestedToken}
                                token={requestedToken}
                                message={<>Your {requestedToken.toUpperCase()} address is required for <span className="url">{variableName}</span></>}
                                onAddress={sdkContainer.updateToAddress}
                            />;
                        } else {
                            depositAddress = sdkContainer.generateAddress() || "";

                            // Show the deposit address and wait for a deposit
                            inner = <ShowDepositAddress
                                mini={paused}
                                order={shift}
                                depositAddress={depositAddress}
                                token={token}
                                utxos={utxos}
                                waitForDeposit={sdkContainer.waitForDeposits}
                                onQRClick={toggleShowQR}
                                onDeposit={uiContainer.deposit}
                            />;
                        }
                        break;
                    case ShiftInStatus.Confirmed:
                    case ShiftInStatus.SubmittedToRenVM:
                        inner = <DepositReceived token={token} mini={paused} renVMStatus={shift.renVMStatus} renTxHash={shift.renTxHash} submitDeposit={sdkContainer.submitMintToRenVM} />;
                        break;
                    case ShiftInStatus.ReturnedFromRenVM:
                    case ShiftInStatus.SubmittedToEthereum:
                        inner = <SubmitToEthereum mini={paused} txHash={shift.outTx} submit={sdkContainer.submitMintToEthereum} />;
                        break;
                    case ShiftInStatus.ConfirmedOnEthereum:
                        return <Complete mini={paused} inTx={shift.inTx} outTx={shift.outTx} />;
                    // onDone().catch((error) => _catchInteractionErr_(error, "Error in OpeningShift: shiftIn > onDone"));
                    // inner = <></>;
                }
            }

            return <>
                {!paused ? <div className="popup--body--details">
                    {showQR && depositAddress ?
                        <QRCodeContainer><QRCode value={`bitcoin:${depositAddress}${amount ? `?amount=${amount}` : ""}`} /></QRCodeContainer>
                        : <>
                            <div className="popup--token--icon"><TokenIcon token={token} /></div>
                            <div className="popup--body--title">
                                Deposit {amount ? <><CopyToClipboard text={`${amount}`}><AmountSpan>{amount}</AmountSpan></CopyToClipboard>{" "}</> : <></>}{token.toUpperCase()}
                            </div>
                            <div>to</div>
                            <ParentContainer>
                                <ParentInfo>
                                    <img alt="" role="presentation" src={`https://s2.googleusercontent.com/s2/favicons?domain_url=${url}`} />{title}
                                </ParentInfo>
                                <Tooltip align="left" width={300} contents={<pre>{url}</pre>}><img alt={`Tooltip: ${url}`} src={infoIcon} /></Tooltip>
                            </ParentContainer>
                        </>}
                </div> : <></>
                }
                {inner}
            </>;
        };

        const shiftOut = () => {
            const { renTxHash, shiftParams, renVMStatus } = shift as ShiftOutEvent;

            const token = shift.shiftParams.sendToken.slice(0, 3) as Token;

            let inner = <></>;

            if (!sdkRenVM) {
                inner = <LogIn token={token} paused={paused} wrongNetwork={uiContainer.state.wrongNetwork} />;
            } else {
                switch (shift.status) {
                    case ShiftOutStatus.Committed:
                        // tslint:disable-next-line: no-unnecessary-type-assertion
                        const requiredAddressAndName = getRequiredAddressAndName(shiftParams);
                        if (requiredAddressAndName) {
                            const [variableName, requiredAddress] = requiredAddressAndName;
                            const requestedToken = requiredAddress[1] as Token || token;
                            inner = <AskForAddress
                                mini={paused}
                                key={requestedToken}
                                token={requestedToken}
                                message={<>Your {requestedToken.toUpperCase()} address is required for <span className="url">{variableName}</span></>}
                                onAddress={sdkContainer.updateToAddress}
                            />;
                        } else {
                            inner = <SubmitToEthereum mini={paused} txHash={shift.inTx} submit={sdkContainer.submitBurnToEthereum} />;
                        }
                        // const submit = async (submitOrderID: string) => {
                        //     await sdkContainer.approveTokenTransfer(submitOrderID);
                        //     setERC20Approved(true);
                        // };
                        // if (isERC20(order.orderInputs.srcToken) && !ERC20Approved) {
                        //     return <TokenAllowance token={order.orderInputs.srcToken} amount={order.orderInputs.srcAmount} submit={submit} shiftParams={shiftParams} />;
                        // }
                        break;
                    case ShiftOutStatus.SubmittedToEthereum:
                        // Submit the trade to Ethereum
                        inner = <SubmitToEthereum mini={paused} txHash={shift.inTx} submit={sdkContainer.submitBurnToEthereum} />;
                        break;
                    case ShiftOutStatus.ConfirmedOnEthereum:
                    case ShiftOutStatus.SubmittedToRenVM:
                        inner = <DepositReceived token={token} mini={paused} renVMStatus={renVMStatus} renTxHash={renTxHash} submitDeposit={sdkContainer.submitBurnToRenVM} />;
                        break;
                    // TODO: Handle `NoBurnFound` properly.
                    case ShiftOutStatus.NoBurnFound:
                        onDone().catch((error) => _catchInteractionErr_(error, "Error in OpeningShift: shiftOut > onDone"));
                        inner = <></>;
                        break;
                    case ShiftOutStatus.ReturnedFromRenVM:
                        return <Complete mini={paused} inTx={shift.inTx} outTx={shift.outTx} />;
                }
            }

            const contractAddress = shift.shiftParams.contractCalls && ((shift.shiftParams.contractCalls[shift.shiftParams.contractCalls?.length - 1] as unknown as DetailedContractCall).sendTo) || "";

            return <>
                {!paused ? <div className="popup--body--details">
                    <div className="popup--token--icon"><TokenIcon token={token} /></div>
                    <div className="popup--body--title">
                        Receive {token.toUpperCase()}
                    </div>
                    <div>from</div>
                    <ParentContainer>
                        <ParentInfo>
                            <img alt="" role="presentation" src={`https://s2.googleusercontent.com/s2/favicons?domain_url=${url}`} />{title}
                        </ParentInfo>
                        <Tooltip align="left" width={300} contents={<pre>{url}</pre>}><img alt={`Tooltip: ${url}`} src={infoIcon} /></Tooltip>
                        <ParentInfo>
                            <span />(<span className="address">{contractAddress.slice(0, 12)}<span>{contractAddress.slice(12, -6)}</span>{contractAddress.slice(-6, -1)}</span>)
                        </ParentInfo>
                    </ParentContainer>
                </div> : <></>}
                {inner}
            </>;
        };

        return shift.shiftParams.sendToken.slice(4, 7).toLowerCase() === "eth" ? shiftOut() : shiftIn();
    }
);
