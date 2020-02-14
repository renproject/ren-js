import {
    Chain, GatewayConstructor, GatewayInstance, GatewayJSConstructor, GatewayJSInterface,
    GatewayMessage, GatewayMessagePayload, GatewayMessageType, GatewayParams, gatewayUtils,
    HistoryEvent, newPromiEvent, PromiEvent, randomBytes, RenNetwork, ShiftInStatus, ShiftOutStatus,
    sleep, Tokens, UnmarshalledTx,
} from "@renproject/ren-js-common";

import { RenElementHTML, RenGatewayContainerHTML } from "./ren";
import {
    createElementFromHTML, GATEWAY_ENDPOINT_PRODUCTION, GATEWAY_ENDPOINT_STAGING, getElement,
    prepareParamsForSendMessage, resolveEndpoint,
} from "./utils";
import { validateString } from "./validate";

export { Chain, RenNetwork as Network, RenNetwork, Tokens, HistoryEvent, ShiftInStatus, ShiftOutStatus, ShiftInEvent, ShiftOutEvent } from "@renproject/ren-js-common";

export class Gateway implements GatewayInstance {

    public static readonly Tokens = Tokens;
    public static readonly Networks = RenNetwork;
    public static readonly Chains = Chain;
    public static readonly ShiftInStatus = ShiftInStatus;
    public static readonly ShiftOutStatus = ShiftOutStatus;
    public static readonly utils = gatewayUtils;

    // tslint:disable: readonly-keyword
    public isPaused = false;
    public isOpen = false;
    private isCancelling = false;
    // tslint:enable: readonly-keyword

    // tslint:disable-next-line: readonly-keyword readonly-array no-any
    private readonly promiEvent: PromiEvent<UnmarshalledTx | {}, { status: [ShiftInStatus | ShiftOutStatus, any] }> = newPromiEvent();

    // Each GatewayJS instance has a unique ID
    private readonly id: string;
    private readonly network: RenNetwork | string;
    private readonly endpoint: string;

    constructor(network: RenNetwork | string, endpoint: string) {
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

    public readonly pause = async () => {
        this._pause();
        await this._sendMessage(GatewayMessageType.Pause, {});
        return this;
    }

    public readonly resume = async () => {
        this._resume();
        await this._sendMessage(GatewayMessageType.Resume, {});
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

    public readonly _open = (shiftParamsIn: GatewayParams): Gateway => {
        const shiftParams = prepareParamsForSendMessage(shiftParamsIn);

        (async () => {

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
                    this.pause().catch(console.error);
                };
            }

        })().catch(this.promiEvent.reject);

        return this;
    }

    private readonly _eventListener = (shiftParams: GatewayParams, onClose: () => void) =>
        // tslint:disable-next-line: no-any
        (e: { readonly data: GatewayMessage<any> }) => {
            if (e.data && e.data.from === "ren" && e.data.frameID === this.id) {
                // alert(`I got a message: ${JSON.stringify(e.data)}`);
                switch (e.data.type) {
                    case GatewayMessageType.Ready:
                        this._sendMessage(GatewayMessageType.Shift, {
                            shift: shiftParams,
                            paused: this.isPaused,
                        }).catch(console.error);
                        break;
                    case GatewayMessageType.Status:
                        this.promiEvent.emit("status", e.data.payload.status, e.data.payload.details);
                        break;
                    case GatewayMessageType.Pause:
                        this._pause();
                        break;
                    case GatewayMessageType.Resume:
                        this._resume();
                        break;
                    case GatewayMessageType.Cancel:
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
                    case GatewayMessageType.Error:
                        onClose();
                        this.promiEvent.reject(new Error(e.data.payload.message || "Error thrown from Gateway iframe."));
                        return;
                    case GatewayMessageType.Done:
                        onClose();
                        this.promiEvent.resolve(e.data.payload);
                        return;
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
        // tslint:disable-next-line: no-any
        const contentWindow = (frame as any).contentWindow;
        while (!acknowledged && contentWindow) {
            const gatewayMessage: GatewayMessage<Type> = { from: "ren", frameID: this.id, type, payload, messageID };
            console.log("gatewayMessage", gatewayMessage);
            contentWindow.postMessage(gatewayMessage, "*");
            // Sleep for 1 second
            await sleep(1 * 1000);
        }
    })

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

const _gatewayTypeCheck: GatewayConstructor = Gateway;

export default class GatewayJS implements GatewayJSInterface {

    public static readonly Tokens = Tokens;
    public static readonly Networks = RenNetwork;
    public static readonly Chains = Chain;
    public static readonly ShiftInStatus = ShiftInStatus;
    public static readonly ShiftOutStatus = ShiftOutStatus;
    public static readonly utils = gatewayUtils;

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
    public readonly getGateways = async (): Promise<Map<string, HistoryEvent>> => {
        return new Gateway(this.network, this.endpoint)._getGateways();
    }

    /**
     * Creates a new Gateway instance. (Note - Exclude<..., "web3Provider">
     *  doesn't seem to work.)
     */
    public readonly open = (params: GatewayParams): Gateway => {
        return new Gateway(this.network, this.endpoint)._open(params);
    }
}

const _gatewayJSTypeCheck: GatewayJSConstructor = GatewayJS;

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
