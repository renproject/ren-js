import * as React from "react";

import {
    GatewayMessageType, ShiftInEvent, ShiftInStatus, ShiftOutEvent, ShiftOutStatus, UnmarshalledTx,
} from "@renproject/interfaces";
import { TokenIcon } from "@renproject/react-components";
import BigNumber from "bignumber.js";
import QRCode from "qrcode.react";
import CopyToClipboard from "react-copy-to-clipboard";
import styled from "styled-components";

import infoIcon from "../../images/icons/info.svg";
import { _catchInteractionErr_ } from "../../lib/errors";
import { postMessageToClient } from "../../lib/postMessage";
import { isFunction, isPromise } from "../../lib/utils";
import { connect, ConnectedProps } from "../../state/connect";
import { Token } from "../../state/generalTypes";
import { SDKContainer } from "../../state/sdkContainer";
import { UIContainer } from "../../state/uiContainer";
import { getURL } from "../controllers/Storage";
import { LogIn } from "../views/LogIn";
import { AskForAddress } from "../views/shift-popup/AskForAddress";
import { Complete } from "../views/shift-popup/Complete";
import { DepositReceived } from "../views/shift-popup/DepositReceived";
import { InvalidParameters } from "../views/shift-popup/InvalidParameters";
import { ShowDepositAddress } from "../views/shift-popup/ShowDepositAddress";
import { SubmitBurnToEthereum } from "../views/shift-popup/SubmitBurnToEthereum";
import { SubmitBurnToRenVM } from "../views/shift-popup/SubmitBurnToRenVM";
import { SubmitMintToEthereum } from "../views/shift-popup/SubmitMintToEthereum";
import { Tooltip } from "../views/tooltip/Tooltip";
import { TransferDetails } from "../views/TransferDetails";

interface Props extends ConnectedProps<[UIContainer, SDKContainer]> {
}

const getRequiredAddressAndName = (shiftParams: ShiftInEvent["shiftParams"] | ShiftOutEvent["shiftParams"]) => shiftParams.contractCalls ? Array.from(shiftParams.contractCalls).reduce((accOuter, contractCall) => {
    if (accOuter !== null || isFunction(contractCall) || isPromise(contractCall)) { return accOuter; }
    return (contractCall.contractParams || []).reduce((acc, param) => {
        if (acc !== null || !param || typeof param.value !== "string") { return acc; }
        const match = param.value.match(/^__renAskForAddress__([a-zA-Z0-9]+)?$/);
        return match ? [param.name, match] : null;
    }, null as [string, RegExpMatchArray] | null);
}, null as [string, RegExpMatchArray] | null) as [string, RegExpMatchArray] | null : null;

const ParentContainer = styled.div`
            display: flex;
            align-content: center;
            align-items: center;
            `;

const ParentInfo = styled.span`
            font-size: 1.8rem;
            margin: 0 5px;
            & > img {
                margin: 0 5px;
            }
                        .address {
                font-size: 1.4rem;
            }
            `;

const AmountSpan = styled.span`
                color: ${props => props.theme.primaryColor};
                cursor: pointer;
            `;

/**
 * OpeningShift is a visual component for allowing users to open new shifts
 */
export const OpeningShift = connect<Props & ConnectedProps<[UIContainer, SDKContainer]>>([UIContainer, SDKContainer])(
    ({ containers: [uiContainer, sdkContainer] }) => {

        const [showQR, setShowQR] = React.useState(false);
        // tslint:disable-next-line: prefer-const
        let [returned, setReturned] = React.useState(false);

        const toggleShowQR = React.useCallback(() => setShowQR(!showQR), [showQR]);

        const onNoBurnFound = async () => {
            if (returned) {
                return;
            }
            returned = true;
            setReturned(true);
            if (uiContainer.state.gatewayPopupID) {
                await sdkContainer.updateShift({ returned: true });
                await postMessageToClient(window, uiContainer.state.gatewayPopupID, GatewayMessageType.Error, { message: `No token burn found in transaction.` });
            }
            uiContainer.resetTrade().catch((error) => _catchInteractionErr_(error, "Error in OpeningShift: onNoBurnFound > resetTrade"));
        };

        const { sdkRenVM, shift } = sdkContainer.state;

        if (!shift) {
            throw new Error(`Unable to load shift details`);
        }

        const { paused, utxos, wrongNetwork, expectedNetwork } = uiContainer.state;

        // const title = window.parent.document.title;
        const url = getURL();

        const urlDomain = (data: string) => {
            const a = document.createElement("a");
            a.href = data;
            return a.hostname;
        };

        const title = urlDomain(url);

        let [pressedDone, setPressedDone] = React.useState(false);
        const onDone = React.useCallback(async () => {
            pressedDone = true;
            setPressedDone(pressedDone);
            let response: {} | UnmarshalledTx = {};
            try {
                response = await sdkContainer.queryShiftStatus();
            } catch (error) {
                _catchInteractionErr_(error, { description: "Error in Main.tsx: onDone > queryShiftStatus" });
            }
            if (uiContainer.state.gatewayPopupID) {
                await sdkContainer.updateShift({ returned: true });
                await postMessageToClient(window, uiContainer.state.gatewayPopupID, GatewayMessageType.Done, response);
            }
            uiContainer.resetTrade().catch((error) => _catchInteractionErr_(error, "Error in OpeningShift: onDone > resetTrade"));
            pressedDone = false;
            setPressedDone(pressedDone);
        }, [uiContainer]);

        const shiftIn = () => {

            const shiftParams = shift.shiftParams as ShiftInEvent["shiftParams"];

            const token = shiftParams.sendToken.slice(0, 3) as Token;

            let depositAddress;

            let inner = <></>;
            if (!sdkRenVM) {
                inner = <LogIn correctNetwork={expectedNetwork || "correct"} token={token} paused={paused} wrongNetwork={wrongNetwork} />;
            } else {
                switch (shift.status) {
                    case ShiftInStatus.Committed:
                        // tslint:disable-next-line: no-unnecessary-type-assertion
                        const requiredAddressAndName = getRequiredAddressAndName(shiftParams);
                        if (requiredAddressAndName !== null) {
                            const [variableName, requiredAddress] = requiredAddressAndName;
                            const requestedToken = requiredAddress[1] as Token || token;
                            inner = <AskForAddress
                                mini={paused}
                                key={requestedToken}
                                token={requestedToken}
                                isTestnet={sdkRenVM.network.isTestnet}
                                message={<>Your {requestedToken.toUpperCase()} address is required for <span className="url">{variableName}</span></>}
                                onAddress={sdkContainer.updateToAddress}
                            />;
                        } else {
                            try {
                                depositAddress = sdkContainer.generateAddress() || "";

                                // Show the deposit address and wait for a deposit
                                inner = <ShowDepositAddress
                                    mini={paused}
                                    order={shift}
                                    depositAddress={depositAddress}
                                    token={token}
                                    utxos={utxos}
                                    sdkRenVM={sdkRenVM}
                                    shiftParams={shiftParams}
                                    waitForDeposit={sdkContainer.waitForDeposits}
                                    confirmations={sdkContainer.getNumberOfConfirmations(shift)}
                                    onQRClick={toggleShowQR}
                                    onDeposit={uiContainer.deposit}
                                    networkDetails={sdkRenVM.network}
                                />;
                            } catch (error) {
                                inner = <InvalidParameters mini={paused} token={token} />;
                            }
                        }
                        break;
                    case ShiftInStatus.Deposited:
                    case ShiftInStatus.Confirmed:
                    case ShiftInStatus.SubmittedToRenVM:
                        try {
                            depositAddress = sdkContainer.generateAddress() || "";


                            // Show the deposit address and wait for a deposit
                            inner = <DepositReceived
                                mini={paused}
                                order={shift}
                                depositAddress={depositAddress}
                                token={token}
                                utxos={utxos}
                                sdkRenVM={sdkRenVM}
                                shiftParams={shiftParams}
                                waitForDeposit={sdkContainer.waitForDeposits}
                                confirmations={sdkContainer.getNumberOfConfirmations(shift)}
                                onQRClick={toggleShowQR}
                                onDeposit={uiContainer.deposit}
                                networkDetails={sdkRenVM.network}
                            />;
                        } catch (error) {
                            inner = <InvalidParameters mini={paused} token={token} />;
                        }
                        break;
                    case ShiftInStatus.ReturnedFromRenVM:
                    case ShiftInStatus.SubmittedToEthereum:
                        inner = <SubmitMintToEthereum shift={shift} networkDetails={sdkRenVM.network} mini={paused} txHash={shift.outTx} submit={sdkContainer.submitMintToEthereum} />;
                        break;
                    case ShiftInStatus.ConfirmedOnEthereum:
                        inner = <Complete onDone={onDone} pressedDone={pressedDone} token={token} networkDetails={sdkRenVM.network} mini={paused} inTx={shift.inTx} outTx={shift.outTx} />;
                        break;
                }
            }

            return <>
                {inner}
                {!paused ? <TransferDetails shift={shift} /> : <></>}
            </>;
        };

        const shiftOut = () => {
            const { renTxHash, shiftParams, renVMStatus } = shift as ShiftOutEvent;

            const token = shift.shiftParams.sendToken.slice(0, 3) as Token;

            let inner = <></>;

            if (!sdkRenVM) {
                inner = <LogIn correctNetwork={expectedNetwork || "correct"} token={token} paused={paused} wrongNetwork={wrongNetwork} />;
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
                                isTestnet={sdkRenVM.network.isTestnet}
                                message={<>Your {requestedToken.toUpperCase()} address is required for <span className="url">{variableName}</span></>}
                                onAddress={sdkContainer.updateToAddress}
                            />;
                        } else {
                            inner = <SubmitBurnToEthereum networkDetails={sdkRenVM.network} mini={paused} txHash={shift.inTx} submit={sdkContainer.submitBurnToEthereum} />;
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
                        inner = <SubmitBurnToEthereum networkDetails={sdkRenVM.network} mini={paused} txHash={shift.inTx} submit={sdkContainer.submitBurnToEthereum} />;
                        break;
                    case ShiftOutStatus.ConfirmedOnEthereum:
                    case ShiftOutStatus.SubmittedToRenVM:
                        inner = <SubmitBurnToRenVM token={token} mini={paused} renVMStatus={renVMStatus} renTxHash={renTxHash} submitDeposit={sdkContainer.submitBurnToRenVM} />;
                        break;
                    case ShiftOutStatus.NoBurnFound:
                        onNoBurnFound().catch((error) => _catchInteractionErr_(error, "Error in OpeningShift: shiftOut > onNoBurnFound"));
                        inner = <></>;
                        break;
                    case ShiftOutStatus.ReturnedFromRenVM:
                        inner = <Complete onDone={onDone} pressedDone={pressedDone} token={token} networkDetails={sdkRenVM.network} mini={paused} inTx={shift.inTx} outTx={shift.outTx} />;
                        break;
                }
            }

            const contractAddress = (shift.shiftParams.contractCalls && ((shift.shiftParams.contractCalls[shift.shiftParams.contractCalls.length - 1]).sendTo)) || "";

            return <>
                {inner}
                {!paused ? <TransferDetails shift={shift} /> : <></>}
            </>;
        };

        return shift.shiftParams.sendToken.slice(4, 7).toLowerCase() === "eth" ? shiftOut() : shiftIn();
    }
);
