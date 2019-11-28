import * as React from "react";

import { Loading, TokenIcon } from "@renproject/react-components";
import BigNumber from "bignumber.js";

import { _catchInteractionErr_ } from "../../lib/errors";
import { connect, ConnectedProps } from "../../state/connect";
import {
    isERC20, ShiftInStatus, ShiftOutEvent, ShiftOutStatus, Token,
} from "../../state/generalTypes";
import { SDKContainer } from "../../state/sdkContainer";
import { UIContainer } from "../../state/uiContainer";
import { DepositReceived } from "../views/order-popup/DepositReceived";
import { ShowDepositAddress } from "../views/order-popup/ShowDepositAddress";
import { SubmitToEthereum } from "../views/order-popup/SubmitToEthereum";
import { TokenAllowance } from "../views/order-popup/TokenAllowance";
import { Popup } from "../views/Popup";

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
            uiContainer.resetTrade().catch(_catchInteractionErr_);
            window.parent.postMessage({ from: "ren", type: "done", payload: { msg: "demo return value" } }, "*");
        };

        const hide = async () => {
            await uiContainer.handleOrder(null);
        };

        const { sdkRenVM } = sdkContainer.state;

        if (!sdkRenVM) {
            return <Popup>
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
                        orderID={orderID}
                        order={order}
                        generateAddress={sdkContainer.generateAddress}
                        token={token}
                        amount={amount}
                        waitForDeposit={sdkContainer.waitForDeposits}
                        cancel={uiContainer.resetTrade}
                    />;
                    break;
                case ShiftInStatus.Deposited:
                case ShiftInStatus.SubmittedToRenVM:
                    inner = <DepositReceived renVMStatus={order.renVMStatus} messageID={order.messageID} orderID={orderID} submitDeposit={sdkContainer.submitMintToRenVM} hide={hide} />;
                    break;
                case ShiftInStatus.ReturnedFromRenVM:
                case ShiftInStatus.SubmittedToEthereum:
                    inner = <SubmitToEthereum txHash={order.outTx} orderID={orderID} submit={sdkContainer.submitMintToEthereum} hide={hide} />;
                    break;
                case ShiftInStatus.RefundedOnEthereum:
                case ShiftInStatus.ConfirmedOnEthereum:
                    onDone().catch(_catchInteractionErr_);
                    inner = <></>;
            }
            return <>
                <div className="popup--body--details">
                    <div className="popup--body--title">Transfer {token.toUpperCase()}</div>
                    <div className="popup--body--values">
                        <span><span className="url"><img alt="" role="presentation" src={`https://s2.googleusercontent.com/s2/favicons?domain_url=${url}`} /> {url}</span>  has requested <span className="url"><TokenIcon token={token} /><span> {amount} {token.toUpperCase()}</span></span> to the contract <span className="monospace url">{"0x1241343431431431431431".slice(0, 12)}...{"0x1241343431431431431431".slice(-5, -1)}</span> on Ethereum.</span>
                    </div>
                </div>
                {inner}
            </>;
        };

        const shiftOut = () => {
            const { messageID, commitment, renVMStatus } = order as ShiftOutEvent;

            switch (order.status) {
                case ShiftOutStatus.Committed:
                    // const submit = async (submitOrderID: string) => {
                    //     await sdkContainer.approveTokenTransfer(submitOrderID);
                    //     setERC20Approved(true);
                    // };
                    // if (isERC20(order.orderInputs.srcToken) && !ERC20Approved) {
                    //     return <TokenAllowance token={order.orderInputs.srcToken} amount={order.orderInputs.srcAmount} orderID={orderID} submit={submit} commitment={commitment} hide={hide} />;
                    // }
                    return <SubmitToEthereum txHash={order.inTx} orderID={orderID} submit={sdkContainer.submitBurnToEthereum} hide={hide} />;
                case ShiftOutStatus.SubmittedToEthereum:
                    // Submit the trade to Ethereum
                    return <SubmitToEthereum txHash={order.inTx} orderID={orderID} submit={sdkContainer.submitBurnToEthereum} hide={hide} />;
                case ShiftOutStatus.ConfirmedOnEthereum:
                case ShiftOutStatus.SubmittedToRenVM:
                    return <DepositReceived renVMStatus={renVMStatus} messageID={messageID} orderID={orderID} submitDeposit={sdkContainer.submitBurnToRenVM} hide={hide} />;
                case ShiftOutStatus.RefundedOnEthereum:
                case ShiftOutStatus.ReturnedFromRenVM:
                    onDone().catch(_catchInteractionErr_);
                    return <></>;
            }
            console.error(`Unknown status in ShiftOut: ${order.status}`);
            return <></>;
        };

        return order.commitment.sendToken.slice(4, 7).toLowerCase() === "eth" ? shiftOut() : shiftIn();
    }
);
