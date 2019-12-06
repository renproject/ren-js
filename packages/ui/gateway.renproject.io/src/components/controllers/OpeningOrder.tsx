import * as React from "react";

import { Loading, TokenIcon } from "@renproject/react-components";
import BigNumber from "bignumber.js";

import { _catchInteractionErr_ } from "../../lib/errors";
import { connect, ConnectedProps } from "../../state/connect";
import { ShiftInStatus, ShiftOutEvent, ShiftOutStatus, Token } from "../../state/generalTypes";
import { SDKContainer } from "../../state/sdkContainer";
import { UIContainer } from "../../state/uiContainer";
import { AskForAddress } from "../views/order-popup/AskForAddress";
import { DepositReceived } from "../views/order-popup/DepositReceived";
import { ShowDepositAddress } from "../views/order-popup/ShowDepositAddress";
import { SubmitToEthereum } from "../views/order-popup/SubmitToEthereum";
import { Popup } from "../views/Popup";
import CopyToClipboard from "react-copy-to-clipboard";

interface Props extends ConnectedProps<[UIContainer, SDKContainer]> {
    orderID: string;
}

/**
 * OpeningOrder is a visual component for allowing users to open new orders
 */
export const OpeningOrder = connect<Props & ConnectedProps<[UIContainer, SDKContainer]>>([UIContainer, SDKContainer])(
    ({ orderID, containers: [uiContainer, sdkContainer] }) => {

        // tslint:disable-next-line: prefer-const
        let [returned, setReturned] = React.useState(false);
        const [ERC20Approved, setERC20Approved] = React.useState(false);

        const onDone = async () => {
            if (returned) {
                return;
            }
            returned = true;
            setReturned(true);
            uiContainer.resetTrade().catch((error) => _catchInteractionErr_(error, "Error in OpeningOrder: onDone > resetTrade"));
            window.parent.postMessage({ from: "ren", type: "done", payload: { msg: "demo return value" } }, "*");
        };

        const { sdkRenVM } = sdkContainer.state;

        if (!sdkRenVM) {
            return <Popup mini={false}>
                <div className="popup--body popup--loading">
                    <Loading />
                    <span>Loading</span>
                </div>
            </Popup>;
        }

        const order = sdkContainer.order(orderID);
        if (!order) {
            throw new Error(`Order ${orderID} not set`);
        }

        const { paused } = uiContainer.state;

        const shiftIn = () => {

            const token = order.commitment.sendToken.slice(0, 3) as Token;
            const amount = new BigNumber(order.commitment.sendAmount).div(new BigNumber(10).exponentiatedBy(8)).toFixed(); // TODO: decimals

            const url = window.location !== window.parent.location
                ? document.referrer
                : document.location.href;

            let inner = <></>;

            switch (order.status) {
                case ShiftInStatus.Committed:
                    // Show the deposit address and wait for a deposit
                    inner = <ShowDepositAddress
                        mini={paused}
                        orderID={orderID}
                        order={order}
                        generateAddress={sdkContainer.generateAddress}
                        token={token}
                        amount={amount}
                        waitForDeposit={sdkContainer.waitForDeposits}
                    />;
                    break;
                case ShiftInStatus.Deposited:
                case ShiftInStatus.SubmittedToRenVM:
                    inner = <DepositReceived mini={paused} renVMStatus={order.renVMStatus} messageID={order.messageID} orderID={orderID} submitDeposit={sdkContainer.submitMintToRenVM} />;
                    break;
                case ShiftInStatus.ReturnedFromRenVM:
                case ShiftInStatus.SubmittedToEthereum:
                    inner = <SubmitToEthereum mini={paused} txHash={order.outTx} orderID={orderID} submit={sdkContainer.submitMintToEthereum} />;
                    break;
                case ShiftInStatus.RefundedOnEthereum:
                case ShiftInStatus.ConfirmedOnEthereum:
                    onDone().catch((error) => _catchInteractionErr_(error, "Error in OpeningOrder: shiftIn > onDone"));
                    inner = <></>;
            }

            return <>
                {!paused ? <div className="popup--body--details">
                    <div className="popup--token--icon"><TokenIcon token={token} /></div>
                    <div className="popup--body--title">Deposit <CopyToClipboard text={`${amount}`}><span className="clickable--amount">{amount}</span></CopyToClipboard> {token.toUpperCase()}</div>
                    <div>to</div>
                    <div className="popup--body--values">
                    <span><span className="url"><img alt="" role="presentation" src={`https://s2.googleusercontent.com/s2/favicons?domain_url=${url}`} /> {url}</span></span>{/* has requested <span className="url"><TokenIcon token={token} /><span> {amount} {token.toUpperCase()}</span></span> to the contract <span className="monospace url">{"0x1241343431431431431431".slice(0, 12)}...{"0x1241343431431431431431".slice(-5, -1)}</span> on Ethereum.</span>*/}
                    </div>
                </div> : <></>
                }
                {inner}
            </>;
        };

        const shiftOut = () => {
            const { messageID, commitment, renVMStatus } = order as ShiftOutEvent;

            const token = order.commitment.sendToken.slice(0, 3) as Token;

            const url = window.location !== window.parent.location
                ? document.referrer
                : document.location.href;

            let inner = <></>;
            switch (order.status) {
                case ShiftOutStatus.Committed:
                    // tslint:disable-next-line: no-unnecessary-type-assertion
                    const requiredAddressAndName = commitment.contractParams.reduce((acc, param) => {
                        if (acc !== null || !param || typeof param.value !== "string") { return acc; }
                        const match = param.value.match(/^__renAskForAddress__([a-zA-Z0-9]+)?$/);
                        return match ? [param.name, match] : null;
                    }, null as [string, RegExpMatchArray] | null) as [string, RegExpMatchArray] | null;
                    if (requiredAddressAndName !== null) {
                        const [variableName, requiredAddress] = requiredAddressAndName;
                        const requestedToken = requiredAddress[1] as Token || token;
                        inner = <AskForAddress
                            orderID={orderID}
                            mini={paused}
                            key={requestedToken}
                            token={requestedToken}
                            message={<>Your {requestedToken.toUpperCase()} address is required for the parameter <span className="url">{variableName}</span></>}
                            onAddress={sdkContainer.updateToAddress}
                        />;
                    } else {
                        inner = <SubmitToEthereum mini={paused} txHash={order.inTx} orderID={orderID} submit={sdkContainer.submitBurnToEthereum} />;
                    }
                    // const submit = async (submitOrderID: string) => {
                    //     await sdkContainer.approveTokenTransfer(submitOrderID);
                    //     setERC20Approved(true);
                    // };
                    // if (isERC20(order.orderInputs.srcToken) && !ERC20Approved) {
                    //     return <TokenAllowance token={order.orderInputs.srcToken} amount={order.orderInputs.srcAmount} orderID={orderID} submit={submit} commitment={commitment} />;
                    // }
                    break;
                case ShiftOutStatus.SubmittedToEthereum:
                    // Submit the trade to Ethereum
                    inner = <SubmitToEthereum mini={paused} txHash={order.inTx} orderID={orderID} submit={sdkContainer.submitBurnToEthereum} />;
                    break;
                case ShiftOutStatus.ConfirmedOnEthereum:
                case ShiftOutStatus.SubmittedToRenVM:
                    inner = <DepositReceived mini={paused} renVMStatus={renVMStatus} messageID={messageID} orderID={orderID} submitDeposit={sdkContainer.submitBurnToRenVM} />;
                    break;
                case ShiftOutStatus.RefundedOnEthereum:
                case ShiftOutStatus.ReturnedFromRenVM:
                    onDone().catch((error) => _catchInteractionErr_(error, "Error in OpeningOrder: shiftOut > onDone"));
                    inner = <></>;
                    break;
            }

            return <>
                {!paused ? <div className="popup--body--details">
                    <div className="popup--body--title">Receive {token.toUpperCase()}</div>
                    <div className="popup--body--values">
                        <span><span className="url"><img alt="" role="presentation" src={`https://s2.googleusercontent.com/s2/favicons?domain_url=${url}`} /> {url}</span> is sending <span className="url"><TokenIcon token={token} /><span> {token.toUpperCase()}</span></span> from the contract <span className="monospace url">{"0x1241343431431431431431".slice(0, 12)}...{"0x1241343431431431431431".slice(-5, -1)}</span>.</span>
                    </div>
                </div> : <></>}
                {inner}
            </>;
        };

        return order.commitment.sendToken.slice(4, 7).toLowerCase() === "eth" ? shiftOut() : shiftIn();
    }
);
