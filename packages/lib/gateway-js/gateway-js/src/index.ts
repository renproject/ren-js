import {
    Chain, GatewayMessage, GatewayMessageType, HistoryEvent, Network, newPromiEvent, PromiEvent,
    SendTokenInterface, ShiftInParamsAll, ShiftInStatus, ShiftOutStatus, ShiftParams, Tokens,
} from "@renproject/ren-js-common";

import { RenElementHTML, RenGatewayContainerHTML } from "./ren";
import {
    createElementFromHTML, GATEWAY_ENDPOINT, getElement, randomBytes, resolveEndpoint, sleep, utils,
} from "./utils";

export { Chain, Network, Tokens, HistoryEvent, ShiftInStatus, ShiftOutStatus, ShiftInEvent, ShiftOutEvent } from "@renproject/ren-js-common";

export class Gateway {

    public static readonly Tokens = Tokens;
    public static readonly Networks = Network;
    public static readonly Chains = Chain;
    public static readonly ShiftInStatus = ShiftInStatus;
    public static readonly ShiftOutStatus = ShiftOutStatus;
    public static readonly utils = utils;

    // tslint:disable: readonly-keyword
    public isPaused = false;
    public isOpen = false;
    private isCancelling = false;
    // tslint:enable: readonly-keyword

    // tslint:disable-next-line: readonly-keyword readonly-array no-any
    private readonly promiEvent: PromiEvent<any, { status: [ShiftInStatus | ShiftOutStatus, any] }> = newPromiEvent();

    // Each GatewayJS instance has a unique ID
    private readonly id: string;
    private readonly endpoint: string;

    // FIXME: Passing in an endpoint is great for development but probably not very secure
    constructor(endpoint?: Network | string) {
        this.endpoint = resolveEndpoint(endpoint || GATEWAY_ENDPOINT);
        this.id = randomBytes(8);

        // setInterval(() => {
        //     if (this.isOpen) {
        //         this.isPaused ? this.pause() : this.resume();
        //     }
        // }, 5 * 1000);
    }

    public readonly getPopup = () => getElement(`_ren_gateway-${this.id}`);
    public readonly getIFrame = () => getElement(`_ren_iframe-${this.id}`);
    public readonly getOrCreateGatewayContainer = () => {
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

    public readonly close = () => {
        try {
            const renElement = this.getPopup();
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

    public readonly getGateways = async () => new Promise<Map<string, HistoryEvent>>((resolve, reject) => {
        const container = this.getOrCreateGatewayContainer();

        const iframe = (uniqueID: string, iframeURL: string) => `
        <iframe class="_ren_iframe-hidden" id="_ren_iframe-hidden-${uniqueID}" style="display: none"
            src="${`${iframeURL}#/get-trades?id=${uniqueID}`}" ></iframe>
        `;

        const popup = createElementFromHTML(iframe(this.id, this.endpoint));

        if (popup) {
            container.insertBefore(popup, container.lastChild);
        }

        // tslint:disable-next-line: no-any
        let listener: (e: { readonly data: GatewayMessage<any> }) => void;

        const close = () => {
            if (popup) {
                window.removeEventListener("message", listener);
                container.removeChild(popup);
            }
        };

        // tslint:disable-next-line: no-any
        listener = (e: { readonly data: GatewayMessage<any> }) => {
            if (e.data && e.data.from === "ren" && e.data.frameID === this.id) {
                // alert(`I got a message: ${JSON.stringify(e.data)}`);
                switch (e.data.type) {
                    case "ready":
                        if (popup) {
                            this._sendMessage(GatewayMessageType.GetTrades, { frameID: this.id }, popup).catch(console.error);
                        }
                        break;
                    case "getTrades":
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

        window.addEventListener("message", listener);
    })

    public readonly open = (shiftParams: (Exclude<ShiftParams, "web3Provider"> & SendTokenInterface) | HistoryEvent): Gateway => {

        // Certain types can't be sent via sendMessage.
        if (typeof (shiftParams as ShiftInParamsAll).sendAmount === "object") {
            // tslint:disable-next-line: no-any no-object-mutation no-unnecessary-type-assertion
            (shiftParams as any).sendAmount = (((shiftParams as ShiftInParamsAll).sendAmount as any).toFixed) ?
                // tslint:disable-next-line: no-any no-unnecessary-type-assertion
                (shiftParams as any).sendAmount.toFixed() :
                // tslint:disable-next-line: no-any no-unnecessary-type-assertion
                (shiftParams as any).sendAmount.toString();
        }

        (async () => {

            // Check that GatewayJS isn't already open
            let existingPopup;
            try { existingPopup = this.getPopup(); } catch (error) { /* Ignore error */ }
            if (existingPopup) { throw new Error("GatewayJS already open"); }

            const container = this.getOrCreateGatewayContainer();

            const popup = createElementFromHTML(RenElementHTML(this.id, `${this.endpoint}#/?id=${this.id}`, this.isPaused));

            if (popup) {
                container.insertBefore(popup, container.lastChild);
                // tslint:disable-next-line: no-object-mutation
                this.isOpen = true;
            }

            // tslint:disable-next-line: no-any
            let listener: (e: { readonly data: GatewayMessage<any> }) => void;

            const close = () => {
                // Remove listener
                window.removeEventListener("message", listener);
                this.close();
            };

            // tslint:disable-next-line: no-any
            listener = (e: { readonly data: GatewayMessage<any> }) => {
                if (e.data && e.data.from === "ren" && e.data.frameID === this.id) {
                    // alert(`I got a message: ${JSON.stringify(e.data)}`);
                    switch (e.data.type) {
                        case "ready":
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
                            close();
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
                        case GatewayMessageType.Done:
                            close();
                            this.promiEvent.resolve(e.data.payload);
                            return;
                    }
                }
            };

            window.addEventListener("message", listener);

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

    public readonly result = () => this.promiEvent;


    private readonly _sendMessage = async <T>(type: GatewayMessageType, payload: T, iframeIn?: ChildNode) => new Promise<void>(async (resolve) => {

        // TODO: Allow response in acknowledgement.

        const frame = iframeIn || this.getIFrame();

        while (!frame) {
            await sleep(1 * 1000);
        }

        const messageID = randomBytes(8);

        // tslint:disable-next-line: no-any
        let listener: (e: { readonly data: GatewayMessage<any> }) => void;

        let acknowledged = false;
        const removeListener = () => {
            acknowledged = true;
            window.removeEventListener("message", listener);
        };

        // tslint:disable-next-line: no-any
        listener = (e: { readonly data: GatewayMessage<any> }) => {
            if (e.data && e.data.from === "ren" && e.data.type === GatewayMessageType.Acknowledgement && e.data.messageID === messageID) {
                removeListener();
                resolve(e.data.payload);
            }
        };

        window.addEventListener("message", listener);

        // Repeat message until acknowledged
        // tslint:disable-next-line: no-any
        const contentWindow = (frame as any).contentWindow;
        while (!acknowledged && contentWindow) {
            const gatewayMessage: GatewayMessage<T> = { from: "ren", frameID: this.id, type, payload, messageID };
            contentWindow.postMessage(gatewayMessage, "*");
            // Sleep for 1 second
            await sleep(1 * 1000);
        }
    })


    private readonly _pause = () => {
        // tslint:disable-next-line: no-object-mutation
        this.isPaused = true;
        this.getPopup().classList.add("_ren_gateway-minified");
    }

    private readonly _resume = () => {
        // tslint:disable-next-line: no-object-mutation
        this.isPaused = false;
        this.getPopup().classList.remove("_ren_gateway-minified");
    }
}

export default class GatewayJS {

    public static readonly Tokens = Tokens;
    public static readonly Networks = Network;
    public static readonly Chains = Chain;
    public static readonly ShiftInStatus = ShiftInStatus;
    public static readonly ShiftOutStatus = ShiftOutStatus;
    public static readonly utils = utils;

    private readonly endpoint: string;
    constructor(endpoint?: Network | string) {
        this.endpoint = resolveEndpoint(endpoint || GATEWAY_ENDPOINT);
    }

    /**
     * Returns a map containing previously opened gateways.
     */
    public readonly getGateways = async (): Promise<Map<string, HistoryEvent>> => {
        return new Gateway(this.endpoint).getGateways();
    }

    /**
     * Creates a new Gateway instance.
     */
    public readonly open = (params: (Exclude<ShiftParams, "web3Provider"> & SendTokenInterface) | HistoryEvent): Gateway => {
        return new Gateway(this.endpoint).open(params);
    }
}



////////////////////////////////////////////////////////////////////////////////
// EXPORTS                                                                    //
// Based on https://github.com/MikeMcl/bignumber.js/blob/master/bignumber.js  //
////////////////////////////////////////////////////////////////////////////////

// tslint:disable: no-any no-object-mutation strict-type-predicates

// tslint:disable-next-line: no-string-literal
(GatewayJS as any)["default"] = (GatewayJS as any).GatewayJS = GatewayJS;

declare global {
    let define: any;
    // let module: any;
}
if (typeof define === "function" && define.amd) {
    // AMD.
    define(() => GatewayJS);

    // @ts-ignore
} else if (typeof module !== "undefined" && module.exports) {
    // Node.js and other environments that support module.exports.
    try {
        // @ts-ignore
        module.exports = GatewayJS;
    } catch (error) {
        // ignore error
    }
} else {
    // Browser.
    if (typeof window !== "undefined" && window) {
        (window as any).GatewayJS = GatewayJS;
    }
}
