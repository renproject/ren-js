import * as React from "react";

import {
    BurnAndReleaseEvent, BurnAndReleaseStatus, GatewayMessageType, LockAndMintEvent,
    LockAndMintStatus, UnmarshalledTx,
} from "@renproject/interfaces";
import styled from "styled-components";

import { _catchInteractionErr_ } from "../../lib/errors";
import { postMessageToClient } from "../../lib/postMessage";
import { isFunction, isPromise } from "../../lib/utils";
import { connect, ConnectedProps } from "../../state/connect";
import { Token } from "../../state/generalTypes";
import { SDKContainer } from "../../state/sdkContainer";
import { UIContainer } from "../../state/uiContainer";
import { LogIn } from "../views/LogIn";
import { AskForAddress } from "../views/transfer-popup/AskForAddress";
import { Complete } from "../views/transfer-popup/Complete";
import { DepositReceived } from "../views/transfer-popup/DepositReceived";
import { InvalidParameters } from "../views/transfer-popup/InvalidParameters";
import { ShowGatewayAddress } from "../views/transfer-popup/ShowGatewayAddress";
import { SubmitBurnToEthereum } from "../views/transfer-popup/SubmitBurnToEthereum";
import { SubmitBurnToRenVM } from "../views/transfer-popup/SubmitBurnToRenVM";
import { SubmitMintToEthereum } from "../views/transfer-popup/SubmitMintToEthereum";
import { TransferDetails } from "../views/TransferDetails";
import { getURL } from "./Storage";

interface Props extends ConnectedProps<[UIContainer, SDKContainer]> {
}

const getRequiredAddressAndName = (transferParams: LockAndMintEvent["transferParams"] | BurnAndReleaseEvent["transferParams"]) => transferParams.contractCalls ? Array.from(transferParams.contractCalls).reduce((accOuter, contractCall) => {
    if (accOuter !== null || isFunction(contractCall) || isPromise(contractCall)) { return accOuter; }
    return (contractCall.contractParams || []).reduce((acc, param) => {
        if (acc !== null || !param || typeof param.value !== "string") { return acc; }
        const match = param.value.match(/^__renAskForAddress__([a-zA-Z0-9]+)?$/);
        return match ? [param.name, match] : null;
    }, null as [string, RegExpMatchArray] | null);
}, null as [string, RegExpMatchArray] | null) as [string, RegExpMatchArray] | null : null;

/**
 * HandlingTransfer is a visual component for allowing users to start new transfers
 */
export const HandlingTransfer = connect<Props & ConnectedProps<[UIContainer, SDKContainer]>>([UIContainer, SDKContainer])(
    ({ containers: [uiContainer, sdkContainer] }) => {

        // tslint:disable-next-line: prefer-const
        let [returned, setReturned] = React.useState(false);

        const onNoBurnFound = async () => {
            if (returned) {
                return;
            }
            returned = true;
            setReturned(true);
            if (uiContainer.state.gatewayPopupID) {
                await sdkContainer.updateTransfer({ returned: true });
                await postMessageToClient(window, uiContainer.state.gatewayPopupID, GatewayMessageType.Error, { message: `No token burn found in transaction.` });
            }
            uiContainer.resetTransfer().catch((error) => { _catchInteractionErr_(error, "Error in HandlingTransfer: onNoBurnFound > resetTransfer"); });
        };

        const { sdkRenVM, transfer } = sdkContainer.state;

        if (!transfer) {
            throw new Error(`Unable to load transfer details`);
        }

        const { paused, utxos, wrongNetwork, expectedNetwork } = uiContainer.state;

        // const title = window.parent.document.title;
        const url = getURL();

        const urlDomain = (data: string) => {
            const a = document.createElement("a");
            a.href = data;
            return a.hostname;
        };

        // tslint:disable-next-line: prefer-const
        let [pressedDone, setPressedDone] = React.useState(false);
        const onDone = React.useCallback(async () => {
            pressedDone = true;
            setPressedDone(pressedDone);
            let response: {} | UnmarshalledTx = {};
            try {
                response = await sdkContainer.queryTransferStatus();
            } catch (error) {
                _catchInteractionErr_(error, { description: "Error in Main.tsx: onDone > queryTransferStatus" });
            }
            if (uiContainer.state.gatewayPopupID) {
                await sdkContainer.updateTransfer({ returned: true });
                await postMessageToClient(window, uiContainer.state.gatewayPopupID, GatewayMessageType.Done, response);
            }
            uiContainer.resetTransfer().catch((error) => _catchInteractionErr_(error, "Error in HandlingTransfer: onDone > resetTransfer"));
            pressedDone = false;
            setPressedDone(pressedDone);
        }, [uiContainer]);

        const lockAndMint = () => {

            const transferParams = transfer.transferParams as LockAndMintEvent["transferParams"];

            const token = transferParams.sendToken.slice(0, 3) as Token;

            let inner = <></>;
            if (!sdkRenVM) {
                inner = <LogIn correctNetwork={expectedNetwork || "correct"} token={token} paused={paused} wrongNetwork={wrongNetwork} />;
            } else {
                switch (transfer.status) {
                    case LockAndMintStatus.Committed:
                        // tslint:disable-next-line: no-unnecessary-type-assertion
                        const requiredAddressAndName = getRequiredAddressAndName(transferParams);
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
                                // Show the deposit address and wait for a deposit
                                inner = <ShowGatewayAddress
                                    mini={paused}
                                    generateAddress={sdkContainer.generateAddress}
                                    token={token}
                                    utxos={utxos}
                                    sdkRenVM={sdkRenVM}
                                    transferParams={transferParams}
                                    waitForDeposit={sdkContainer.waitForDeposits}
                                    confirmations={sdkContainer.getNumberOfConfirmations(transfer)}
                                    onDeposit={uiContainer.deposit}
                                />;
                            } catch (error) {
                                inner = <InvalidParameters mini={paused} token={token} />;
                            }
                        }
                        break;
                    case LockAndMintStatus.Deposited:
                    case LockAndMintStatus.Confirmed:
                    case LockAndMintStatus.SubmittedToRenVM:
                        try {
                            // Show the deposit address and wait for a deposit
                            inner = <DepositReceived
                                mini={paused}
                                token={token}
                                utxos={utxos}
                                waitForDeposit={sdkContainer.waitForDeposits}
                                confirmations={sdkContainer.getNumberOfConfirmations(transfer)}
                                onDeposit={uiContainer.deposit}
                                networkDetails={sdkRenVM.network}
                            />;
                        } catch (error) {
                            inner = <InvalidParameters mini={paused} token={token} />;
                        }
                        break;
                    case LockAndMintStatus.ReturnedFromRenVM:
                    case LockAndMintStatus.SubmittedToEthereum:
                        inner = <SubmitMintToEthereum transfer={transfer} networkDetails={sdkRenVM.network} mini={paused} txHash={transfer.outTx} submit={sdkContainer.submitMintToEthereum} />;
                        break;
                    case LockAndMintStatus.ConfirmedOnEthereum:
                        inner = <Complete onDone={onDone} pressedDone={pressedDone} token={token} networkDetails={sdkRenVM.network} mini={paused} inTx={transfer.inTx} outTx={transfer.outTx} />;
                        break;
                }
            }

            return <>
                {inner}
                {!paused ? <TransferDetails transfer={transfer} /> : <></>}
            </>;
        };

        const burnAndRelease = () => {
            const { txHash, transferParams, renVMStatus } = transfer as BurnAndReleaseEvent;

            const token = transfer.transferParams.sendToken.slice(0, 3) as Token;
            const txCount = (transferParams.contractCalls || []).length;

            let inner = <></>;

            if (!sdkRenVM) {
                inner = <LogIn correctNetwork={expectedNetwork || "correct"} token={token} paused={paused} wrongNetwork={wrongNetwork} />;
            } else {
                switch (transfer.status) {
                    case BurnAndReleaseStatus.Committed:
                        // tslint:disable-next-line: no-unnecessary-type-assertion
                        const requiredAddressAndName = getRequiredAddressAndName(transferParams);
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
                            inner = <SubmitBurnToEthereum txCount={txCount} networkDetails={sdkRenVM.network} mini={paused} txHash={transfer.inTx} submit={sdkContainer.submitBurnToEthereum} />;
                        }
                        // const submit = async (submitOrderID: string) => {
                        //     await sdkContainer.approveTokenTransfer(submitOrderID);
                        //     setERC20Approved(true);
                        // };
                        // if (isERC20(order.orderInputs.srcToken) && !ERC20Approved) {
                        //     return <TokenAllowance token={order.orderInputs.srcToken} amount={order.orderInputs.srcAmount} submit={submit} transferParams={transferParams} />;
                        // }
                        break;
                    case BurnAndReleaseStatus.SubmittedToEthereum:
                        // Submit the burn to Ethereum
                        inner = <SubmitBurnToEthereum txCount={txCount} networkDetails={sdkRenVM.network} mini={paused} txHash={transfer.inTx} submit={sdkContainer.submitBurnToEthereum} />;
                        break;
                    case BurnAndReleaseStatus.ConfirmedOnEthereum:
                    case BurnAndReleaseStatus.SubmittedToRenVM:
                        inner = <SubmitBurnToRenVM token={token} mini={paused} renVMStatus={renVMStatus} txHash={txHash} submitDeposit={sdkContainer.submitBurnToRenVM} />;
                        break;
                    case BurnAndReleaseStatus.NoBurnFound:
                        onNoBurnFound().catch((error) => { _catchInteractionErr_(error, "Error in HandlingTransfer: burnAndRelease > onNoBurnFound"); });
                        inner = <></>;
                        break;
                    case BurnAndReleaseStatus.ReturnedFromRenVM:
                        inner = <Complete onDone={onDone} pressedDone={pressedDone} token={token} networkDetails={sdkRenVM.network} mini={paused} inTx={transfer.inTx} outTx={transfer.outTx} />;
                        break;
                }
            }

            const contractAddress = (transfer.transferParams.contractCalls && ((transfer.transferParams.contractCalls[transfer.transferParams.contractCalls.length - 1]).sendTo)) || "";

            return <>
                {inner}
                {!paused ? <TransferDetails transfer={transfer} /> : <></>}
            </>;
        };

        return transfer.transferParams.sendToken.slice(4, 7).toLowerCase() === "eth" ? burnAndRelease() : lockAndMint();
    }
);
