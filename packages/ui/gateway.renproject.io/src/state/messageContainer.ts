import * as Sentry from "@sentry/browser";

import {
    BurnAndReleaseEvent, BurnAndReleaseParams, BurnAndReleaseStatus, Chain, EventType,
    GatewayMessage, GatewayMessageType, HistoryEvent, LockAndMintEvent, LockAndMintParams,
    LockAndMintStatus, SendTokenInterface, SerializableTransferParams,
} from "@renproject/interfaces";
import RenJS from "@renproject/ren";
import {
    Ox, processBurnAndReleaseParams, processLockAndMintParams, sleep, strip0x,
} from "@renproject/utils";
import { List } from "immutable";
import { parse as parseLocation } from "qs";
import { useCallback, useEffect, useState } from "react";
import { useLocation } from "react-router";
import { createContainer } from "unstated-next";

import { DEFAULT_NETWORK } from "../lib/environmentVariables";
import { _catchInteractionErr_ } from "../lib/errors";
import { acknowledgeMessage, addMessageListener, postMessageToClient } from "../lib/postMessage";
import { extractQuery, getAsset } from "../lib/utils";
import { SDKContainer } from "./sdkContainer";
import { TransferContainer } from "./transferContainer";
import { UIContainer } from "./uiContainer";

export const useMessageContainer = () => {

    const uiContainer = UIContainer.useContainer();
    const sdkContainer = SDKContainer.useContainer();
    const transferContainer = TransferContainer.useContainer();

    const location = useLocation();

    const reportError = useCallback(async (errorMessage: string) => {
        if (uiContainer.gatewayPopupID) {
            await postMessageToClient(window, uiContainer.gatewayPopupID, GatewayMessageType.Error, { message: errorMessage });
        }
    }, [uiContainer]);

    const pause = useCallback(async (fromClient?: boolean) => {
        if (!fromClient) {
            if (uiContainer.gatewayPopupID) {
                await postMessageToClient(window, uiContainer.gatewayPopupID, GatewayMessageType.Pause, {});
            }
        }
        return uiContainer.pause();
    }, [uiContainer]);

    const resume = useCallback(async (fromClient?: boolean) => {
        if (!fromClient) {
            if (uiContainer.gatewayPopupID) {
                await postMessageToClient(window, uiContainer.gatewayPopupID, GatewayMessageType.Resume, {});
            }
        }
        return uiContainer.resume();
    }, [uiContainer]);

    const cancelTransfer = useCallback(async (fromClient?: boolean) => {
        if (!sdkContainer.transfer || !uiContainer.renNetwork) {
            _catchInteractionErr_(new Error("Missing transfer or network details for cancelTransfer"), "Error in Main.tsx > cancelTransfer");
            return;
        }

        if (sdkContainer.transfer.transferParams.nonce) {
            await sdkContainer.updateTransfer({ archived: true });
            // await removeStorageTransfer(uiContainer.renNetwork, sdkContainer.transfer.transferParams.nonce);
            // TODO: Handle no nonce.
        }
        if (!fromClient && uiContainer.gatewayPopupID) {
            await sdkContainer.updateTransfer({ returned: true });
            await sleep(100);
            await postMessageToClient(window, uiContainer.gatewayPopupID, GatewayMessageType.Cancel, {});
        }
    }, [uiContainer, sdkContainer]);

    const { renNetwork, toggleSettings } = uiContainer;
    const { renJS,
        updateTransfer,
        getTransferStatus,
        transfer,
    } = sdkContainer;
    const { store, getTransfers } = transferContainer;

    // tslint:disable-next-line: no-any
    const [messages, setMessages] = useState(List<GatewayMessage<any>>());

    useEffect(() => {
        const queryParams = parseLocation(location.search.replace(/^\?/, ""));
        const queryTransferID = extractQuery(queryParams.id, null);
        uiContainer.handleTransfer(queryTransferID).catch(console.error);

        const urlRenNetwork = extractQuery(queryParams.network, DEFAULT_NETWORK);
        uiContainer.setRenNetwork(urlRenNetwork);
        transferContainer.connect(urlRenNetwork);

        if (queryTransferID) {
            postMessageToClient(window, queryTransferID, GatewayMessageType.Ready, {}).catch(console.error);
        }

        // tslint:disable-next-line: no-any
        addMessageListener((e: { data: GatewayMessage<any> }) => {
            if (!e) {
                return;
            }
            const message = e.data;
            if (message && message.from === "ren" && message.frameID === queryTransferID) {
                setMessages(currentMessages => currentMessages.push(message));
            }
        });

        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [location.search]);

    useEffect(() => {
        if (!messages.size) {
            return;
        }
        // Remove first message from list for processing.
        const message = messages.first(undefined);
        setMessages(messages.slice(1));
        if (!message) {
            return;
        }
        (async () => {
            switch (message.type) {
                case GatewayMessageType.TransferDetails:
                    acknowledgeMessage(message);
                    const { cancelled: alreadyCancelled, paused: alreadyPaused, transferDetails: transferParamsIn }: { cancelled: boolean, paused: boolean, transferDetails: SerializableTransferParams | LockAndMintEvent | BurnAndReleaseEvent } = (message as GatewayMessage<GatewayMessageType.TransferDetails>).payload;
                    await (alreadyPaused ? pause() : resume());
                    const transferID = message.frameID;
                    const time = Date.now() / 1000;

                    const randomID = Ox(strip0x(transferID).repeat(4).slice(0, 64));

                    let historyEvent: HistoryEvent | undefined;
                    let transferParams: HistoryEvent["transferParams"];

                    if (transferParamsIn.hasOwnProperty("transferParams")) {
                        historyEvent = transferParamsIn as unknown as HistoryEvent;
                        transferParams = { ...historyEvent.transferParams };
                        transferParams.nonce = transferParams.nonce || randomID;
                    } else {
                        historyEvent = undefined;
                        transferParams = {
                            ...(transferParamsIn as (BurnAndReleaseParams & LockAndMintParams & SendTokenInterface)),
                            nonce: (transferParamsIn as (BurnAndReleaseParams & LockAndMintParams & SendTokenInterface)).nonce || randomID,
                        };
                    }

                    let transferDetails;

                    const network = (renJS || new RenJS(renNetwork)).network;

                    if (transferParams.sendToken === RenJS.Tokens.BTC.Btc2Eth ||
                        transferParams.sendToken === RenJS.Tokens.ZEC.Zec2Eth ||
                        transferParams.sendToken === RenJS.Tokens.BCH.Bch2Eth) {
                        transferDetails = {
                            // Cast required by TS to differentiate LockAndMint and BurnAndRelease types.
                            eventType: EventType.LockAndMint as const,
                            status: LockAndMintStatus.Committed,
                            // tslint:disable-next-line: no-object-literal-type-assertion
                            transferParams: processLockAndMintParams(network, transferParams as LockAndMintParams) as LockAndMintEvent["transferParams"],
                        };
                    } else {
                        transferDetails = {
                            eventType: EventType.BurnAndRelease as const,
                            status: BurnAndReleaseStatus.Committed,
                            transferParams: processBurnAndReleaseParams(network, transferParams as BurnAndReleaseParams) as unknown as BurnAndReleaseEvent["transferParams"],
                        };
                    }

                    let detailsFromLocalStorage;
                    if (store && transferDetails.transferParams.nonce) {
                        try {
                            detailsFromLocalStorage = await store.get(transferDetails.transferParams.nonce);
                        } catch (error) {
                            console.error(error);
                        }
                    }

                    // tslint:disable-next-line: no-object-literal-type-assertion
                    historyEvent = {
                        inTx: null,
                        outTx: null,
                        txHash: null,
                        renVMStatus: null,
                        renVMQuery: null,

                        ...detailsFromLocalStorage,

                        archived: alreadyCancelled,
                        returned: false,
                        id: transferID,
                        time,
                        ...transferDetails,
                        ...historyEvent,
                    } as LockAndMintEvent | BurnAndReleaseEvent;

                    if (!historyEvent.transferParams.sendToken) {
                        reportError("No sendToken provided").catch(console.error);
                    }

                    await updateTransfer(historyEvent);

                    try {
                        // Until confidence is gained in the storage
                        // of transfers, the transfer details are
                        // stored in the error log as an additional
                        // backup.

                        Sentry.configureScope((scope) => {
                            // scope.setUser({ id: address });
                            scope.setExtra("transfer", historyEvent && JSON.stringify(historyEvent.transferParams));
                            if (historyEvent) {
                                scope.setTag("token", getAsset(historyEvent));
                                scope.setTag("network", network.name);
                            }
                        });
                        if (historyEvent.eventType === EventType.LockAndMint) {
                            const lastContractCall = historyEvent.transferParams.contractCalls && historyEvent.transferParams.contractCalls[historyEvent.transferParams.contractCalls.length - 1];
                            Sentry.captureException(new Error(`Mint - ${historyEvent.transferParams.suggestedAmount && historyEvent.transferParams.suggestedAmount.toString()} ${historyEvent.transferParams.sendToken}, ${lastContractCall && lastContractCall.contractFn} - ${lastContractCall && lastContractCall.sendTo}`));
                        } else {
                            const lastContractCall = historyEvent.transferParams.contractCalls && historyEvent.transferParams.contractCalls[historyEvent.transferParams.contractCalls.length - 1];
                            Sentry.captureException(new Error(`Burn - ${historyEvent.transferParams.sendToken}, ${lastContractCall && lastContractCall.contractFn} - ${lastContractCall && lastContractCall.sendTo}`));
                        }
                    } catch (error) {
                        // Ignore error
                    }

                    break;
                case GatewayMessageType.ToggleSettings:
                    acknowledgeMessage(message);
                    toggleSettings().catch(console.error);

                    break;
                case GatewayMessageType.Pause:
                    acknowledgeMessage(message);
                    pause(true).catch(console.error);

                    break;
                case GatewayMessageType.Cancel:
                    acknowledgeMessage(message);
                    cancelTransfer(true).catch(console.error);
                    break;
                case GatewayMessageType.Resume:
                    acknowledgeMessage(message);
                    resume(true).catch(console.error);
                    break;
                case GatewayMessageType.GetTransfers:
                    const transfers = await getTransfers();
                    await postMessageToClient(window, message.frameID, GatewayMessageType.Transfers, transfers);
                    break;
                case GatewayMessageType.GetStatus:
                    acknowledgeMessage(message, getTransferStatus());
                    break;
                case GatewayMessageType.SendEthereumTxConfirmations:
                    acknowledgeMessage(message);
                    const { txHash, confirmations: ethereumConfirmations } = (message as GatewayMessage<GatewayMessageType.SendEthereumTxConfirmations>).payload;
                    // Check that the txHash matches what's stored in the store.
                    if (transfer && transfer.eventType === EventType.BurnAndRelease && transfer.inTx && transfer.inTx.chain === Chain.Ethereum && transfer.inTx.hash === txHash) {
                        await updateTransfer({ ethereumConfirmations });
                    }
                    break;
                default:
                    // Acknowledge that we got the message. We don't
                    // know how to handle it, but we don't want
                    // the parent window to keep re-sending it.
                    acknowledgeMessage(message);
            }
        })().catch((error) => { _catchInteractionErr_(error, "Error in App: onMessage"); });

    }, [messages, renNetwork, toggleSettings, updateTransfer, getTransferStatus, transfer, cancelTransfer, pause, renJS, reportError, resume, store, getTransfers]);

    return {
        pause,
        resume,
        reportError,
        cancelTransfer,
    };
};

export const MessageContainer = createContainer(useMessageContainer);
