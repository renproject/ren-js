import {
    Chain, GatewayMessage, GatewayMessagePayload, GatewayMessageResponse, GatewayMessageType,
    HistoryEvent, newPromiEvent, PromiEvent, RenNetwork, SendParams, ShiftInEvent, ShiftInParams,
    ShiftInStatus, ShiftOutEvent, ShiftOutParams, ShiftOutStatus, ShiftParams, sleep, Tokens,
    UnmarshalledTx,
} from "@renproject/interfaces";
import {
    extractBurnReference, randomBytes, resolveSendCall, stringToNetwork, utils, waitForReceipt,
    withDefaultAccount,
} from "@renproject/utils";
import Web3 from "web3";
import { provider } from "web3-providers";

import { RenElementHTML, RenGatewayContainerHTML } from "./ren";
import {
    createElementFromHTML, GATEWAY_ENDPOINT_PRODUCTION, GATEWAY_ENDPOINT_STAGING, getElement,
    prepareParamsForSendMessage, resolveEndpoint,
} from "./utils";
import { validateString } from "./validate";

export { Chain, RenNetwork as Network, RenNetwork, Tokens, HistoryEvent, ShiftInStatus, ShiftOutStatus, ShiftInEvent, ShiftOutEvent } from "@renproject/interfaces";

export class Gateway {

    public static readonly Tokens = Tokens;
    public static readonly Networks = RenNetwork;
    public static readonly Chains = Chain;
    public static readonly ShiftInStatus = ShiftInStatus;
    public static readonly ShiftOutStatus = ShiftOutStatus;
    public static readonly utils = utils;

    // tslint:disable: readonly-keyword
    public isPaused = false;
    public isOpen = false;
    public currentProvider = undefined as provider | undefined;
    private web3 = undefined as Web3 | undefined;
    private isCancelling = false;
    // tslint:enable: readonly-keyword

    // tslint:disable-next-line: readonly-keyword readonly-array no-any
    private readonly promiEvent: PromiEvent<UnmarshalledTx | {}, { status: [ShiftInStatus | ShiftOutStatus, any] }> = newPromiEvent();

    // Each GatewayJS instance has a unique ID
    private readonly id: string;
    private readonly network: RenNetwork;
    private readonly endpoint: string;

    constructor(network: RenNetwork, endpoint: string) {
        this.network = network;
        this.endpoint = endpoint;
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
            console.error(error);
        }
    }

    public readonly pause = () => {
        this._pause();
        this._sendMessage(GatewayMessageType.Pause, {}).catch(console.error);
        return this;
    }

    public readonly resume = () => {
        this._resume();
        this._sendMessage(GatewayMessageType.Resume, {}).catch(console.error);
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

    public readonly _getGateways = async () => new Promise<Map<string, HistoryEvent>>((resolve, reject) => {
        const container = this._getOrCreateGatewayContainer();

        const iframe = (uniqueID: string, iframeURL: string) => `
        <iframe class="_ren_iframe-hidden" id="_ren_iframe-hidden-${uniqueID}" style="display: none"
            src="${iframeURL}"></iframe>
        `;

        const endpoint = resolveEndpoint(this.endpoint, this.network, "get-trades", this.id);
        const popup = createElementFromHTML(iframe(this.id, endpoint));

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
                this._acknowledgeMessage(e.data, {}, popup).catch(console.error);
                // alert(`I got a message: ${JSON.stringify(e.data)}`);
                switch (e.data.type) {
                    case GatewayMessageType.Ready:
                        if (popup) {
                            this._sendMessage(GatewayMessageType.GetTrades, {}, popup).catch(console.error);
                        }
                        break;
                    case GatewayMessageType.Trades:
                    // `GetTrades` remains for backwards compatibility
                    case GatewayMessageType.GetTrades:
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

    public readonly result = () => this.promiEvent;

    public readonly _open = (shiftParams: ShiftParams | SendParams | ShiftInEvent | ShiftOutEvent, web3Provider?: provider): Gateway => {

        (async () => {


            // tslint:disable-next-line: no-object-mutation
            this.web3 = new Web3(web3Provider || (shiftParams as ShiftParams).web3Provider);

            if ((shiftParams as SendParams).sendAmount) {
                // tslint:disable-next-line: no-parameter-reassignment
                shiftParams = await resolveSendCall(this.web3, stringToNetwork(this.network), shiftParams as SendParams);
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
            listener = this._eventListener(shiftParams, onClose);


            this._addListener(listener);

            // Add handler to overlay
            const overlay = document.querySelector("._ren_overlay");
            if (overlay) {
                // tslint:disable-next-line: no-object-mutation no-any
                (overlay as any).onclick = () => {
                    this.pause();
                };
            }

        })().catch(this.promiEvent.reject);

        return this;
    }

    // withDefaultAccount
    private readonly _eventListener = (shiftParams: ShiftInParams | ShiftOutParams | ShiftInEvent | ShiftOutEvent, onClose: () => void) =>
        // tslint:disable-next-line: no-any
        (e: { readonly data: GatewayMessage<any> }) => {
            if (e.data && e.data.from === "ren" && e.data.frameID === this.id) {
                // alert(`I got a message: ${JSON.stringify(e.data)}`);
                switch (e.data.type) {
                    case GatewayMessageType.Ready:
                        this._acknowledgeMessage(e.data).catch(console.error);
                        const shiftParamsFixed = prepareParamsForSendMessage(shiftParams);
                        this._sendMessage(GatewayMessageType.Shift, {
                            shift: shiftParamsFixed,
                            paused: this.isPaused,
                        }).catch(console.error);
                        break;
                    case GatewayMessageType.Status:
                        this._acknowledgeMessage(e.data).catch(console.error);
                        this.promiEvent.emit("status", e.data.payload.status, e.data.payload.details);
                        break;
                    case GatewayMessageType.Pause:
                        this._acknowledgeMessage(e.data).catch(console.error);
                        this._pause();
                        break;
                    case GatewayMessageType.Resume:
                        this._acknowledgeMessage(e.data).catch(console.error);
                        this._resume();
                        break;
                    case GatewayMessageType.Cancel:
                        this._acknowledgeMessage(e.data).catch(console.error);
                        onClose();
                        if (this.isCancelling) {
                            // tslint:disable-next-line: no-object-mutation
                            this.isCancelling = false;
                            return;
                        } else {
                            // tslint:disable-next-line: no-object-mutation
                            this.isCancelling = false;
                            this.promiEvent.reject(new Error("Shift cancelled by user"));
                            return;
                        }
                    case GatewayMessageType.SendTransaction:
                        (async () => {
                            try {
                                if (!this.web3) {
                                    throw new Error(`No Web3 defined`);
                                }
                                const txConfig = await withDefaultAccount(this.web3, (e.data.payload as GatewayMessagePayload<GatewayMessageType.SendTransaction>).transactionConfig);
                                const promiEvent = this.web3.eth.sendTransaction(txConfig);
                                const txHash = await new Promise<string>((resolve, reject) => {
                                    promiEvent.on("transactionHash", resolve);
                                    promiEvent.catch(reject);
                                });
                                this._acknowledgeMessage<GatewayMessageType.SendTransaction>(e.data, { txHash }).catch(console.error);
                            } catch (error) {
                                console.error(error);
                                this._acknowledgeMessage(e.data, { error: String(error.message || error) }).catch(console.error);
                            }
                        })().catch(console.error);
                        return;
                    case GatewayMessageType.GetTransactionStatus:
                        (async () => {
                            try {
                                if (!this.web3) {
                                    throw new Error(`No Web3 defined`);
                                }
                                const txHash = (e.data.payload as GatewayMessagePayload<GatewayMessageType.GetTransactionStatus>).txHash;
                                await waitForReceipt(this.web3, txHash);
                                this._acknowledgeMessage<GatewayMessageType.GetTransactionStatus>(e.data, { confirmations: 0 }).catch(console.error);
                            } catch (error) {
                                console.error(error);
                                this._acknowledgeMessage(e.data, { error: String(error.message || error) }).catch(console.error);
                            }
                        })().catch(console.error);
                        return;
                    case GatewayMessageType.GetTransactionBurn:
                        (async () => {
                            try {
                                if (!this.web3) {
                                    throw new Error(`No Web3 defined`);
                                }
                                const txHash = (e.data.payload as GatewayMessagePayload<GatewayMessageType.GetTransactionBurn>).txHash;

                                const burnReference = await extractBurnReference(this.web3, txHash);
                                this._acknowledgeMessage<GatewayMessageType.GetTransactionBurn>(e.data, { burnReference }).catch(console.error);
                            } catch (error) {
                                console.error(error);
                                this._acknowledgeMessage(e.data, { error: String(error.message || error) }).catch(console.error);
                            }
                        })().catch(console.error);
                        return;
                    case GatewayMessageType.Error:
                        this._acknowledgeMessage(e.data).catch(console.error);
                        onClose();
                        this.promiEvent.reject(new Error(e.data.payload.message || "Error thrown from Gateway iframe."));
                        return;
                    case GatewayMessageType.Done:
                        this._acknowledgeMessage(e.data).catch(console.error);
                        onClose();
                        this.promiEvent.resolve(e.data.payload);
                        return;
                    default:
                        this._acknowledgeMessage(e.data).catch(console.error);
                }
            }
        }

    // tslint:disable-next-line: no-any
    private readonly _sendMessage = async <Type extends GatewayMessageType>(type: Type, payload: GatewayMessagePayload<Type>, iframeIn?: ChildNode) => new Promise<any>(async (resolve) => {

        // TODO: Allow response in acknowledgement.

        const frame = iframeIn || this._getIFrame();

        while (!frame) {
            await sleep(1 * 1000);
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
            await sleep(1 * 1000);
        }
    })

    // tslint:disable-next-line: no-any
    private readonly _acknowledgeMessage = async <Type extends GatewayMessageType>(message: GatewayMessage<Type>, payload?: GatewayMessageResponse<Type>, iframeIn?: ChildNode | null) => {
        if (message.type === GatewayMessageType.Acknowledgement) {
            return;
        }

        const frame = iframeIn || this._getIFrame();

        while (!frame) {
            await sleep(1 * 1000);
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

    private readonly _pause = () => {
        // tslint:disable-next-line: no-object-mutation
        this.isPaused = true;
        this._getPopup().classList.add("_ren_gateway-minified");
    }

    private readonly _resume = () => {
        // tslint:disable-next-line: no-object-mutation
        this.isPaused = false;
        this._getPopup().classList.remove("_ren_gateway-minified");
    }

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
    public static readonly ShiftInStatus = ShiftInStatus;
    public static readonly ShiftOutStatus = ShiftOutStatus;
    public static readonly utils = utils;

    private readonly network: RenNetwork;
    private readonly endpoint: string;
    // tslint:disable-next-line: readonly-keyword
    constructor(network: RenNetwork | string, options?: { endpoint?: string }) {
        const publicNetworks: readonly RenNetwork[] = [RenNetwork.Chaosnet, RenNetwork.Testnet];
        validateString<RenNetwork>(network, `Invalid network. Expected one of ${publicNetworks.join(", ")}`, Object.values(RenNetwork) as readonly RenNetwork[]);
        this.network = network as RenNetwork;
        // NOTE: In a future release, all networks will use the production endpoint.
        this.endpoint = (options && (options.endpoint === "staging" ? GATEWAY_ENDPOINT_STAGING : options.endpoint)) || GATEWAY_ENDPOINT_PRODUCTION;
    }

    /**
     * Returns a map containing previously opened gateways.
     */
    public readonly getGateways = async (options?: { all: boolean }): Promise<Map<string, HistoryEvent>> => {
        const gateways = await new Gateway(this.network, this.endpoint)._getGateways();

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
     * Creates a new Gateway instance. (Note - Exclude<..., "web3Provider">
     *  doesn't seem to work.)
     */
    public readonly shiftIn = (params: ShiftInParams): Gateway => {
        return new Gateway(this.network, this.endpoint)._open(params);
    }

    public readonly shiftOut = (params: ShiftOutParams): Gateway => {
        return new Gateway(this.network, this.endpoint)._open(params);
    }

    public readonly send = (params: SendParams): Gateway => {
        return new Gateway(this.network, this.endpoint)._open(params);
    }

    public readonly recoverShift = (web3Provider: provider, params: ShiftInEvent | ShiftOutEvent): Gateway => {
        return new Gateway(this.network, this.endpoint)._open(params, web3Provider);
    }
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
