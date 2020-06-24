import * as React from "react";

import {
    Asset, BurnAndReleaseEvent, BurnAndReleaseStatus, GatewayMessageType, LockAndMintEvent,
    LockAndMintStatus, UnmarshalledTx,
} from "@renproject/interfaces";
import { sleep } from "@renproject/react-components";

import { _catchInteractionErr_ } from "../../lib/errors";
import { postMessageToClient } from "../../lib/postMessage";
import { connect, ConnectedProps } from "../../state/connect";
import { SDKContainer } from "../../state/sdkContainer";
import { UIContainer } from "../../state/uiContainer";
import { LogIn } from "../views/LogIn";
import { TransferDetails } from "../views/TransferDetails";
import { Complete } from "./pages/Complete";
import { DepositReceived } from "./pages/DepositReceived";
import { InvalidParameters } from "./pages/InvalidParameters";
import { ShowGatewayAddress } from "./pages/ShowGatewayAddress";
import { SubmitBurnToEthereum } from "./pages/SubmitBurnToEthereum";
import { SubmitBurnToRenVM } from "./pages/SubmitBurnToRenVM";
import { SubmitMintToEthereum } from "./pages/SubmitMintToEthereum";

interface Props extends ConnectedProps<[UIContainer, SDKContainer]> {
}

/**
 * HandlingTransfer is a visual component for allowing users to start new transfers
 */
export const HandlingTransfer = connect<Props & ConnectedProps<[UIContainer, SDKContainer]>>([UIContainer, SDKContainer])(
    ({ containers: [uiContainer, sdkContainer] }) => {

        const [returned, setReturned] = React.useState(false);

        const onNoBurnFound = async () => {
            if (returned) {
                return;
            }
            setReturned(true);
            await sleep(0);
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

        const [pressedDone, setPressedDone] = React.useState(false);
        const onDone = React.useCallback(async () => {
            await sleep(0);
            setPressedDone(true);
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
            uiContainer.resetTransfer().catch((error) => { _catchInteractionErr_(error, "Error in HandlingTransfer: onDone > resetTransfer"); });
            setPressedDone(false);
        }, [uiContainer, sdkContainer]);

        const requestNotificationPermission = React.useCallback(async () => uiContainer.state.gatewayPopupID ? await postMessageToClient(window, uiContainer.state.gatewayPopupID, GatewayMessageType.RequestNotificationPermission, {}) : null, [uiContainer.state.gatewayPopupID]);
        const showNotification = React.useCallback(async (title: string, body: string) => {
            if (uiContainer.state.gatewayPopupID) {
                return await postMessageToClient(window, uiContainer.state.gatewayPopupID, GatewayMessageType.ShowNotification, { title, body });
            }
            return null;
        }, [uiContainer.state.gatewayPopupID]);

        const lockAndMint = () => {

            const transferParams = transfer.transferParams as LockAndMintEvent["transferParams"];

            const token = transferParams.sendToken.slice(0, 3) as Asset;

            let inner = <></>;
            if (!sdkRenVM) {
                inner = <LogIn correctNetwork={expectedNetwork || "correct"} token={token} paused={paused} wrongNetwork={wrongNetwork} />;
            } else {
                switch (transfer.status) {
                    case LockAndMintStatus.Committed:
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
                                requestNotificationPermission={requestNotificationPermission}
                                showNotification={showNotification}
                            />;
                        } catch (error) {
                            inner = <InvalidParameters mini={paused} token={token} />;
                        }
                        break;
                    case LockAndMintStatus.ReturnedFromRenVM:
                    case LockAndMintStatus.SubmittedToEthereum:
                        inner = <SubmitMintToEthereum transfer={transfer} networkDetails={sdkRenVM.network} mini={paused} txHash={transfer.outTx} submit={sdkContainer.submitMintToEthereum} token={token} />;
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

            const token = transfer.transferParams.sendToken.slice(0, 3) as Asset;
            const txCount = (transferParams.contractCalls || []).length;

            let inner = <></>;

            if (!sdkRenVM) {
                inner = <LogIn correctNetwork={expectedNetwork || "correct"} token={token} paused={paused} wrongNetwork={wrongNetwork} />;
            } else {
                switch (transfer.status) {
                    case BurnAndReleaseStatus.Committed:
                        inner = <SubmitBurnToEthereum
                            token={token}
                            txCount={txCount}
                            networkDetails={sdkRenVM.network}
                            mini={paused}
                            txHash={transfer.inTx}
                            submit={sdkContainer.submitBurnToEthereum}
                            ethereumConfirmations={transfer.ethereumConfirmations}
                            requestNotificationPermission={requestNotificationPermission}
                            showNotification={showNotification}
                        />;
                        break;
                    case BurnAndReleaseStatus.SubmittedToEthereum:
                        // Submit the burn to Ethereum
                        inner = <SubmitBurnToEthereum
                            token={token}
                            txCount={txCount}
                            networkDetails={sdkRenVM.network}
                            mini={paused}
                            txHash={transfer.inTx}
                            submit={sdkContainer.submitBurnToEthereum}
                            ethereumConfirmations={transfer.ethereumConfirmations}
                            requestNotificationPermission={requestNotificationPermission}
                            showNotification={showNotification}
                        />;
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

            // const contractAddress = (transfer.transferParams.contractCalls && ((transfer.transferParams.contractCalls[transfer.transferParams.contractCalls.length - 1]).sendTo)) || "";

            return <>
                {inner}
                {!paused ? <TransferDetails transfer={transfer} /> : <></>}
            </>;
        };

        return transfer.transferParams.sendToken.slice(4, 7).toLowerCase() === "eth" ? burnAndRelease() : lockAndMint();
    }
);
