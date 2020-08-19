// tslint:disable: no-console

import { RenNetworkDetails } from "@renproject/contracts";
import {
    Asset,
    BurnAndReleaseEvent,
    BurnAndReleaseParams,
    BurnAndReleaseParamsSimple,
    BurnAndReleaseStatus,
    Chain,
    EventType,
    GatewayMessage,
    GatewayMessagePayload,
    GatewayMessageResponse,
    GatewayMessageType,
    HistoryEvent,
    LockAndMintEvent,
    LockAndMintParams,
    LockAndMintParamsSimple,
    LockAndMintStatus,
    Logger,
    LogLevel,
    LogLevelString,
    RenContract,
    RenNetwork,
    RenTokens,
    SendParams,
    SimpleLogger,
    Tokens,
    TransferParams,
    UnmarshalledTx,
} from "@renproject/interfaces";
import {
    extractBurnReference,
    extractError,
    findTransactionBySigHash,
    getGatewayAddress,
    getTokenAddress,
    newPromiEvent,
    parseRenContract,
    PromiEvent,
    randomBytes,
    resolveSendCall,
    SECONDS,
    sleep,
    stringToNetwork,
    utils,
    waitForReceipt,
    withDefaultAccount,
} from "@renproject/utils";
import Push from "push.js";
import Web3 from "web3";
import { provider as Web3Provider } from "web3-providers";

import { RenElementHTML, RenGatewayContainerHTML, RenIFrame } from "./html";
import {
    createElementFromHTML,
    GATEWAY_ENDPOINT_PRODUCTION,
    GATEWAY_ENDPOINT_STAGING,
    getElement,
    prepareParamsForSendMessage,
    resolveEndpoint,
} from "./utils";
import { validateString } from "./validate";
import { useBrowserWeb3 } from "./web3";

const ON_CONFIRMATION_HANDLER_LIMIT = 30;

export interface GatewayJSConfig {
    endpoint?: string;
    logLevel?: LogLevelString;
    logger?: Logger;
}

// tslint:disable-next-line: no-any
export type GatewayResult = PromiEvent<UnmarshalledTx | {}, { status: [LockAndMintStatus | BurnAndReleaseStatus, any], transferUpdated: [HistoryEvent] }>;

export class Gateway {

    // tslint:disable: readonly-keyword
    public isPaused = false;
    public isOpen = false;
    public currentProvider = undefined as Web3Provider | undefined;
    private web3 = undefined as Web3 | undefined;
    private isCancelling = false;
    // tslint:enable: readonly-keyword

    // tslint:disable-next-line: readonly-keyword readonly-array no-any
    private readonly promiEvent: GatewayResult = newPromiEvent();

    // Each GatewayJS instance has a unique ID
    private readonly id: string;
    private readonly network: RenNetworkDetails;
    private readonly endpoint: string;
    private readonly logger: Logger;

    constructor(network: RenNetworkDetails, config: GatewayJSConfig) {
        this.logger = (config && config.logger) || new SimpleLogger((config && config.logLevel) || LogLevel.Error);
        this.network = network;
        if (!config.endpoint) {
            throw new Error("Must provide endpoint in Gateway config");
        }
        this.endpoint = config.endpoint;
        this.id = randomBytes(8);
    }

    public readonly close = () => {
        try {
            const renElement = this._getPopup();
            if (renElement.parentElement) {
                renElement.parentElement.removeChild(renElement);
            }
            // tslint:disable-next-line: no-object-mutation
            this.isOpen = false;
        } catch (error) {
            this.logger.error(error);
        }
    }

    public readonly pause = () => {
        this._pause();
        this._sendMessage(GatewayMessageType.Pause, {}).catch(this.logger.error);
        return this;
    }

    public readonly resume = () => {
        this._resume();
        this._sendMessage(GatewayMessageType.Resume, {}).catch(this.logger.error);
        return this;
    }

    public readonly cancel = async () => {
        // tslint:disable-next-line: no-object-mutation
        this.isCancelling = true;
        await this._sendMessage(GatewayMessageType.Cancel, {});
        return this;
    }

    public readonly getStatus = async () => {
        return this._sendMessage(GatewayMessageType.GetStatus, {});
    }

    // tslint:disable-next-line: promise-must-complete
    public readonly _getGateways = async () => new Promise<Map<string, HistoryEvent>>((resolve, reject) => {
        const container = this._getOrCreateGatewayContainer();

        const endpoint = resolveEndpoint(this.endpoint, this.network, "get-transfers", this.id);
        const popup = createElementFromHTML(RenIFrame(this.id, endpoint));

        if (popup) {
            container.insertBefore(popup, container.lastChild);
        }

        // tslint:disable-next-line: no-any
        let listener: (e: { readonly data: GatewayMessage<any> }) => void;

        const close = () => {
            if (popup) {
                this._removeListener(listener);
                container.removeChild(popup);
            }
        };

        // tslint:disable-next-line: no-any
        listener = (e: { readonly data: GatewayMessage<any> }) => {
            if (e.data && e.data.from === "ren" && e.data.frameID === this.id) {
                this._acknowledgeMessage(e.data, {}, popup).catch(this.logger.error);
                // alert(`I got a message: ${JSON.stringify(e.data)}`);
                switch (e.data.type) {
                    case GatewayMessageType.Ready:
                        if (popup) {
                            this._sendMessage(GatewayMessageType.GetTransfers, {}, popup).catch(this.logger.error);
                        }
                        break;
                    case GatewayMessageType.Transfers:
                        if (e.data.error) {
                            close();
                            reject(new Error(e.data.error));
                        } else {
                            close();
                            resolve(e.data.payload);
                        }
                        break;
                }
            }
        };

        this._addListener(listener);
    })

    public readonly result: () => GatewayResult = () => this.promiEvent;

    public readonly _open = (transferParams: TransferParams | SendParams | LockAndMintEvent | BurnAndReleaseEvent, web3Provider?: Web3Provider): Gateway => {

        (async () => {

            // Provider can be null if the developer is handling transactions
            // outside of GatewayJS.
            const provider: Web3Provider = web3Provider || (transferParams as TransferParams).web3Provider;
            if (provider !== null) {
                this.web3 = new Web3(provider);
            }

            // tslint:disable-next-line: no-object-mutation

            if ((transferParams as SendParams).sendAmount) {
                // tslint:disable-next-line: no-parameter-reassignment
                transferParams = resolveSendCall(stringToNetwork(this.network), transferParams as SendParams);
            }

            // Check that GatewayJS isn't already open
            let existingPopup;
            try { existingPopup = this._getPopup(); } catch (error) { /* Ignore error */ }
            if (existingPopup) { throw new Error("GatewayJS already open"); }

            const container = this._getOrCreateGatewayContainer();

            const endpoint = resolveEndpoint(this.endpoint, this.network, "", this.id);
            const popup = createElementFromHTML(RenElementHTML(this.id, endpoint, this.isPaused));

            if (popup) {
                container.insertBefore(popup, container.lastChild);
                // tslint:disable-next-line: no-object-mutation
                this.isOpen = true;
            }

            // tslint:disable-next-line: no-any
            let listener: (e: { readonly data: GatewayMessage<any> }) => void;

            const onClose = () => {
                // Remove listener
                this._removeListener(listener);
                this.close();
            };

            // tslint:disable-next-line: no-any
            listener = this._eventListener(transferParams, onClose);


            this._addListener(listener);

            // Add handler to overlay
            const overlay = this._getOverlay();
            if (overlay) {
                // tslint:disable-next-line: no-object-mutation no-any
                (overlay as any).onclick = () => {
                    this.pause();
                };
            }

            // Add handler to settings button
            const settingsButton = this._getSettingsButton();
            if (settingsButton) {
                // tslint:disable-next-line: no-object-mutation no-any
                (settingsButton as any).onclick = () => {
                    this._toggleSettings();
                };
            }

            // Add handler to settings button
            const notificationButton = this._getNotificationButton();
            if (notificationButton) {
                // tslint:disable-next-line: no-object-mutation no-any
                (notificationButton as any).onclick = () => {
                    try {
                        if (!Push.Permission.has()) {
                            Push.Permission.request();
                        }
                    } catch (error) {
                        this.logger.error(error);
                    }
                    notificationButton.classList.add("_ren_notifications-hidden");
                };
            }

            if (Push.Permission.has()) {
                notificationButton.classList.add("_ren_notifications-hidden");
            }

        })().catch(this.promiEvent.reject);

        return this;
    }

    private readonly _eventListener = (transferParams: LockAndMintParams | BurnAndReleaseParams | LockAndMintEvent | BurnAndReleaseEvent, onClose: () => void) =>
        (e: { readonly data: GatewayMessage<GatewayMessageType> }) => {
            if (e.data && e.data.from === "ren" && e.data.frameID === this.id) {
                // alert(`I got a message: ${JSON.stringify(e.data)}`);
                switch (e.data.type) {
                    case GatewayMessageType.Ready:
                        this._acknowledgeMessage(e.data).catch(this.logger.error);
                        const transferParamsFixed = prepareParamsForSendMessage(transferParams);
                        this._sendMessage(GatewayMessageType.TransferDetails, {
                            transferDetails: transferParamsFixed,
                            paused: this.isPaused,
                            cancelled: this.isCancelling,
                        }).catch(this.logger.error);
                        break;
                    case GatewayMessageType.Status:
                        this._acknowledgeMessage(e.data).catch(this.logger.error);
                        const { status, details } = (e.data as GatewayMessage<GatewayMessageType.Status>).payload;
                        if (status) {
                            this.promiEvent.emit("status", status, details);
                        }
                        break;
                    case GatewayMessageType.TransferUpdated:
                        this._acknowledgeMessage(e.data).catch(this.logger.error);
                        const { transfer } = (e.data as GatewayMessage<GatewayMessageType.TransferUpdated>).payload;
                        this.promiEvent.emit("transferUpdated", transfer);
                        break;
                    case GatewayMessageType.Pause:
                        this._acknowledgeMessage(e.data).catch(this.logger.error);
                        this._pause();
                        break;
                    case GatewayMessageType.Resume:
                        this._acknowledgeMessage(e.data).catch(this.logger.error);
                        this._resume();
                        break;
                    case GatewayMessageType.Cancel:
                        this._acknowledgeMessage(e.data).catch(this.logger.error);
                        onClose();
                        if (this.isCancelling) {
                            // tslint:disable-next-line: no-object-mutation
                            this.isCancelling = false;
                            return;
                        } else {
                            // tslint:disable-next-line: no-object-mutation
                            this.isCancelling = false;
                            this.promiEvent.reject(new Error("Transfer cancelled by user"));
                            return;
                        }
                    case GatewayMessageType.SendEthereumTx:
                        (async () => {
                            try {
                                if (!this.web3) {
                                    throw new Error(`No Web3 defined`);
                                }
                                const txConfig = await withDefaultAccount(this.web3, (e.data.payload as GatewayMessagePayload<GatewayMessageType.SendEthereumTx>).transactionConfig);
                                const promiEvent = this.web3.eth.sendTransaction(txConfig);
                                const txHash = await new Promise<string>((resolve, reject) => {
                                    promiEvent.on("transactionHash", resolve);
                                    promiEvent.catch(reject);
                                });
                                // It may be simpler to replace with
                                // `promiEvent.on`, depending on wether or not
                                // .on causes indefinite network requests or
                                // if web3 fetches blocks anyways.
                                const listenForConfirmations = () => promiEvent.once("confirmation", (confirmations) => {
                                    this._sendMessage(GatewayMessageType.SendEthereumTxConfirmations, { txHash, confirmations }).catch(this.logger.error);
                                    if (confirmations < ON_CONFIRMATION_HANDLER_LIMIT) {
                                        listenForConfirmations();
                                    }
                                });
                                listenForConfirmations();
                                this._acknowledgeMessage<GatewayMessageType.SendEthereumTx>(e.data as GatewayMessage<GatewayMessageType.SendEthereumTx>, { txHash }).catch(this.logger.error);
                            } catch (error) {
                                this._acknowledgeMessage(e.data, { error: extractError(error) }).catch(this.logger.error);
                            }
                        })().catch(this.logger.error);
                        return;
                    case GatewayMessageType.GetEthereumTxStatus:
                        (async () => {
                            try {
                                if (!this.web3) {
                                    throw new Error(`No Web3 defined`);
                                }
                                const txHash = (e.data.payload as GatewayMessagePayload<GatewayMessageType.GetEthereumTxStatus>).txHash;
                                const currentBlock = await this.web3.eth.getBlockNumber();
                                const receipt = await waitForReceipt(this.web3, txHash);
                                const confirmations = Math.max(currentBlock - receipt.blockNumber, 0);
                                this._acknowledgeMessage<GatewayMessageType.GetEthereumTxStatus>(e.data as GatewayMessage<GatewayMessageType.GetEthereumTxStatus>, { confirmations, reverted: false }).catch(this.logger.error);
                            } catch (error) {
                                // TODO: Check if tx was reverted or getting receipt failed.
                                this._acknowledgeMessage(e.data, { reverted: true, error: extractError(error) }).catch(this.logger.error);
                            }
                        })().catch(this.logger.error);
                        return;
                    case GatewayMessageType.GetEthereumTxBurn:
                        (async () => {
                            try {
                                if (!this.web3) {
                                    throw new Error(`No Web3 defined`);
                                }
                                const txHash = (e.data.payload as GatewayMessagePayload<GatewayMessageType.GetEthereumTxBurn>).txHash;

                                const burnReference = await extractBurnReference(this.web3, txHash);
                                this._acknowledgeMessage<GatewayMessageType.GetEthereumTxBurn>(e.data as GatewayMessage<GatewayMessageType.GetEthereumTxBurn>, { burnReference }).catch(this.logger.error);
                            } catch (error) {
                                this.logger.error(error);
                                this._acknowledgeMessage(e.data, { error: extractError(error) }).catch(this.logger.error);
                            }
                        })().catch(this.logger.error);
                        return;
                    case GatewayMessageType.FindMintTransaction:
                        (async () => {
                            try {
                                if (!this.web3) {
                                    throw new Error(`No Web3 defined`);
                                }
                                const { sigHash, token } = e.data.payload as GatewayMessagePayload<GatewayMessageType.FindMintTransaction>;
                                const txHash = await findTransactionBySigHash(this.network, this.web3, token, sigHash, this.logger);

                                this._acknowledgeMessage<GatewayMessageType.FindMintTransaction>(e.data as GatewayMessage<GatewayMessageType.FindMintTransaction>, { txHash }).catch(this.logger.error);
                            } catch (error) {
                                this.logger.error(error);
                                this._acknowledgeMessage(e.data, { error: extractError(error) }).catch(this.logger.error);
                            }
                        })().catch(this.logger.error);
                        return;
                    case GatewayMessageType.Error:
                        this._acknowledgeMessage(e.data).catch(this.logger.error);
                        onClose();
                        this.promiEvent.reject(new Error(e.data.payload.message || "Error thrown from Gateway iframe."));
                        return;
                    case GatewayMessageType.Done:
                        this._acknowledgeMessage(e.data).catch(this.logger.error);
                        onClose();
                        this.promiEvent.resolve(e.data.payload);
                        return;
                    case GatewayMessageType.RequestNotificationPermission:
                        this._acknowledgeMessage(e.data, {}).catch(this.logger.error);
                        if (!Push.Permission.has()) {
                            this._getNotificationButton().classList.add("_ren_notifications-blue");
                        }
                        return;
                    case GatewayMessageType.ShowNotification:
                        this._acknowledgeMessage(e.data).catch(this.logger.error);
                        const { title, body } = e.data.payload as GatewayMessagePayload<GatewayMessageType.ShowNotification>;
                        try {
                            if (Push.Permission.has()) {
                                // tslint:disable-next-line: insecure-random
                                const tag = String(Math.random());
                                Push.create(title, {
                                    body,
                                    icon: "https://gateway.renproject.io/favicon.ico",
                                    timeout: 4000,
                                    tag,
                                    onClick: () => {
                                        window.focus();
                                        Push.close(tag);
                                        this.resume();
                                    }
                                }).catch(this.logger.error);
                            }
                        } catch (error) {
                            this.logger.error(error);
                        }
                        return;
                    default:
                        this._acknowledgeMessage(e.data).catch(this.logger.error);
                }
            }
        }

    // tslint:disable-next-line: no-any
    private readonly _sendMessage = async <Type extends GatewayMessageType>(type: Type, payload: GatewayMessagePayload<Type>, iframeIn?: ChildNode) => new Promise<any>(async (resolve) => {

        // TODO: Allow response in acknowledgement.

        let frame;
        try {
            frame = iframeIn || this._getIFrame();
        } catch (error) {
            this.logger.error(error);
            return;
        }

        while (!frame) {
            await sleep(1 * SECONDS);
        }

        const messageID = randomBytes(8);

        // tslint:disable-next-line: no-any
        let listener: (e: { readonly data: GatewayMessage<any> }) => void;

        let acknowledged = false;
        const removeListener = () => {
            acknowledged = true;
            this._removeListener(listener);
        };

        // tslint:disable-next-line: no-any
        listener = (e: { readonly data: GatewayMessage<any> }) => {
            if (e.data && e.data.from === "ren" && e.data.type === GatewayMessageType.Acknowledgement && e.data.messageID === messageID) {
                removeListener();
                resolve(e.data.payload);
            }
        };

        this._addListener(listener);

        // Repeat message until acknowledged
        let count = 0;
        // tslint:disable-next-line: no-any
        const contentWindow = (frame as any).contentWindow;
        while (!acknowledged && contentWindow) {
            if (count >= 1000) {
                throw new Error(`Lost communication with Gateway iFrame - unable post message.`);
            }

            count++;
            const gatewayMessage: GatewayMessage<Type> = { from: "ren", frameID: this.id, type, payload, messageID };
            contentWindow.postMessage(gatewayMessage, "*");
            // Sleep for 1 second
            await sleep(1 * SECONDS);
        }
    })

    // tslint:disable-next-line: no-any
    private readonly _acknowledgeMessage = async <Type extends GatewayMessageType>(message: GatewayMessage<Type>, payload?: GatewayMessageResponse<Type>, iframeIn?: ChildNode | null) => {
        if (message.type === GatewayMessageType.Acknowledgement) {
            return;
        }

        let frame;
        try {
            frame = iframeIn || this._getIFrame();
        } catch (error) {
            this.logger.error(error);
            return;
        }

        while (!frame) {
            await sleep(1 * SECONDS);
        }

        const response: GatewayMessage<GatewayMessageType.Acknowledgement> = { from: "ren", type: GatewayMessageType.Acknowledgement, frameID: message.frameID, payload: payload || {}, messageID: message.messageID };
        // tslint:disable-next-line: no-any
        const contentWindow = (frame as any).contentWindow;
        contentWindow.postMessage(response, "*");
    }

    // tslint:disable-next-line: no-any
    private readonly _addListener = (listener: (e: { readonly data: GatewayMessage<any> }) => void) => {
        window.addEventListener("message", listener);
    }

    // tslint:disable-next-line: no-any
    private readonly _removeListener = (listener: (e: { readonly data: GatewayMessage<any> }) => void) => {
        window.removeEventListener("message", listener);
    }

    private readonly _toggleSettings = () => {
        this._sendMessage(GatewayMessageType.ToggleSettings, {}).catch(this.logger.error);
    }

    private readonly _pause = () => {
        // tslint:disable-next-line: no-object-mutation
        this.isPaused = true;
        try { this._getPopup().classList.add("_ren_gateway-minified"); } catch (error) { this.logger.error(error); }
    }

    private readonly _resume = () => {
        // tslint:disable-next-line: no-object-mutation
        this.isPaused = false;
        try { this._getPopup().classList.remove("_ren_gateway-minified"); } catch (error) { this.logger.error(error); }
    }

    private readonly _getSettingsButton = () => getElement(`_ren_settings-${this.id}`);
    private readonly _getNotificationButton = () => getElement(`_ren_notifications-${this.id}`);
    private readonly _getOverlay = () => getElement(`_ren_overlay-${this.id}`);
    private readonly _getPopup = () => getElement(`_ren_gateway-${this.id}`);
    private readonly _getIFrame = () => getElement(`_ren_iframe-${this.id}`);
    private readonly _getOrCreateGatewayContainer = () => {
        try {
            return getElement(`_ren_gatewayContainer`);
        } catch (error) {
            // Ignore error
        }

        const body: ReadonlyArray<HTMLBodyElement | HTMLHtmlElement> = [...(Array.from(document.getElementsByTagName("body")) || []), ...(Array.from(document.getElementsByTagName("html")) || [])];

        const popup = createElementFromHTML(RenGatewayContainerHTML());

        if (body[0] && popup) {
            body[0].insertBefore(popup, body[0].lastChild);
        }

        return getElement(`_ren_gatewayContainer`);
    }

}

export default class GatewayJS {

    public static readonly Tokens = Tokens;
    public static readonly Networks = RenNetwork;
    public static readonly Chains = Chain;
    public static readonly LockAndMintStatus = LockAndMintStatus;
    public static readonly BurnAndReleaseStatus = BurnAndReleaseStatus;
    public static readonly utils: ((typeof utils) & { useBrowserWeb3: typeof useBrowserWeb3 }) = { ...utils, useBrowserWeb3 };

    private readonly network: RenNetworkDetails;
    private readonly config: GatewayJSConfig;

    // tslint:disable-next-line: readonly-keyword
    constructor(network?: RenNetwork | string, config?: GatewayJSConfig) {
        const publicNetworks: readonly RenNetwork[] = [RenNetwork.Mainnet, RenNetwork.Chaosnet, RenNetwork.Testnet];
        if (typeof network === "string") {
            validateString<RenNetwork>(network, `Invalid network. Expected one of ${publicNetworks.join(", ")}`, Object.values(RenNetwork) as readonly RenNetwork[]);
        }
        this.network = stringToNetwork(network);
        // NOTE: In a future release, all networks will use the production endpoint.
        this.config = {
            ...config,
            endpoint: (config && (config.endpoint === "staging" ? GATEWAY_ENDPOINT_STAGING : config.endpoint)) || GATEWAY_ENDPOINT_PRODUCTION,
        };
    }

    /**
     * Returns a map containing previously opened gateways.
     */
    public readonly getGateways = async (options?: { all: boolean }): Promise<Map<string, HistoryEvent>> => {
        const gateways = await new Gateway(this.network, this.config)._getGateways();

        // Delete gateways that have been returned
        if (!options || !options.all) {
            for (const key of gateways.keys()) {
                const gateway = gateways.get(key);
                if (gateway && gateway.returned) {
                    gateways.delete(key);
                }
            }
        }

        return gateways;
    }

    /**
     * Start a cross-chain transfer onto Ethereum.
     *
     * @param {(LockAndMintParams | LockAndMintParamsSimple | SendParams)} params An object specifying the details
     *        required for the transfer.
     * @returns {Gateway}
     */
    public readonly lockAndMint = (params: LockAndMintParams | LockAndMintParamsSimple | SendParams): Gateway => {
        if ((params as SendParams).sendTo && !(params as LockAndMintParamsSimple).contractFn) {
            params = resolveSendCall(this.network, params as SendParams);
        } else if ((params as LockAndMintParamsSimple).sendTo) {
            const { sendTo, contractFn, contractParams, txConfig, ...restOfParams } = params as LockAndMintParamsSimple;
            params = { ...restOfParams, contractCalls: [{ sendTo, contractFn, contractParams, txConfig }] };
        }
        return new Gateway(this.network, this.config)._open(params);
    }

    /**
     * Start a cross-chain transfer away from Ethereum.
     *
     * @param {(BurnAndReleaseParams | BurnAndReleaseParamsSimple | SendParams)} params An object specifying the details
     *        required for the transfer.
     * @returns {Gateway}
     */
    public readonly burnAndRelease = (params: BurnAndReleaseParams | BurnAndReleaseParamsSimple | SendParams): Gateway => {
        if ((params as SendParams).sendTo && !(params as BurnAndReleaseParamsSimple).contractFn) {
            params = resolveSendCall(this.network, params as SendParams);
        } else if ((params as LockAndMintParamsSimple).sendTo) {
            const { sendTo, contractFn, contractParams, txConfig, ...restOfParams } = params as BurnAndReleaseParamsSimple;
            params = { ...restOfParams, contractCalls: [{ sendTo, contractFn, contractParams, txConfig }] };
        }
        return new Gateway(this.network, this.config)._open(params);
    }

    public readonly open = (params: LockAndMintParams | BurnAndReleaseParams | LockAndMintParamsSimple | BurnAndReleaseParamsSimple | SendParams | LockAndMintEvent | BurnAndReleaseEvent) => {
        // tslint:disable-next-line: strict-type-predicates
        if ((params as LockAndMintEvent).eventType === EventType.LockAndMint) {
            return this.recoverTransfer(undefined as unknown as Web3Provider, params as LockAndMintEvent | BurnAndReleaseEvent);
        }

        const sendToken = (params as LockAndMintParams).sendToken;
        if (sendToken === "BTC" || sendToken === "ZEC" || sendToken === "BCH") {
            throw new Error(`Ambiguous token ${sendToken} - call "lockAndMint" or "burnAndRelease" instead of "open"`);
        }
        if (parseRenContract(sendToken).to === Chain.Ethereum) {
            return this.lockAndMint(params as LockAndMintParams);
        } else {
            return this.burnAndRelease(params as BurnAndReleaseParams);
        }
    }

    public readonly send = (params: SendParams): Gateway => {
        return new Gateway(this.network, this.config)._open(params);
    }

    public readonly recoverTransfer = (web3Provider: Web3Provider, params: LockAndMintEvent | BurnAndReleaseEvent): Gateway => {
        return new Gateway(this.network, this.config)._open(params, web3Provider);
    }

    public readonly getTokenAddress = (web3: Web3, token: RenTokens | RenContract | Asset | ("BTC" | "ZEC" | "BCH")) => getTokenAddress(stringToNetwork(this.network), web3, token);
    public readonly getGatewayAddress = (web3: Web3, token: RenTokens | RenContract | Asset | ("BTC" | "ZEC" | "BCH")) => getGatewayAddress(stringToNetwork(this.network), web3, token);
}

////////////////////////////////////////////////////////////////////////////////
// EXPORTS                                                                    //
// Based on https://github.com/MikeMcl/bignumber.js/blob/master/bignumber.js  //
////////////////////////////////////////////////////////////////////////////////

// tslint:disable: no-any no-object-mutation strict-type-predicates no-typeof-undefined

// tslint:disable-next-line: no-string-literal
(GatewayJS as any)["default"] = (GatewayJS as any).GatewayJS = GatewayJS;

// AMD
try {
    // @ts-ignore
    if (typeof define === "function" && define.amd) { define(() => GatewayJS); }
} catch (error) { /* ignore */ }

// Node.js and other environments that support module.exports.
try { // @ts-ignore
    if (typeof module !== "undefined" && module.exports) { module.exports = GatewayJS; }
} catch (error) { /* ignore */ }

// Browser.
try {
    // @ts-ignore
    if (typeof window !== "undefined" && window) { (window as any).GatewayJS = GatewayJS; }
} catch (error) { /* ignore */ }
