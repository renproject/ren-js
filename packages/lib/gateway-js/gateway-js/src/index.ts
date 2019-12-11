import { RenElementHTML, RenGatewayContainerHTML } from "./ren";

// tslint:disable

const GATEWAY_ENDPOINT = "https://gateway-js.herokuapp.com/";

export interface Commitment {
    sendToken: string;
    sendTo: string;
    sendAmount: number;
    contractFn: string;
    contractParams: Array<{ name: string, value: string, type: string }>;
}

// const sleep = (time: number) => new Promise((resolve) => setTimeout(resolve, time));

const getElement = (id: string) => {
    const element = document.getElementById(id);
    if (!element) {
        throw new Error(`Unable to find element ${id}`);
    }
    return element;
}

function createElementFromHTML(htmlString: string) {
    var div = document.createElement('div');
    div.innerHTML = htmlString.trim();

    // Change this to div.childNodes to support multiple top-level nodes
    return div.firstChild;
}

// box-shadow: 0 0 32px 10px rgba(100, 100, 100, 0.9); 
class GatewayJS {
    private id: string;
    private endpoint: string;
    public paused = false;

    constructor() {
        this.id = "1234";
        this.endpoint = GATEWAY_ENDPOINT;
    }

    public getPopup = () => getElement(`_ren_gateway-${this.id}`);
    public getIFrame = () => getElement(`_ren_iframe-${this.id}`)
    // public getIFrameShadow = () => getElement(`_ren_iframeShadow-${this.id}`);
    public getOrCreateGatewayContainer = () => {
        try {
            return getElement(`_ren_gatewayContainer`);
        } catch (error) {
            // Ignore error
        }

        var body = [...(Array.from(document.getElementsByTagName('body')) || []), ...(Array.from(document.getElementsByTagName('html')) || [])];

        const popup = createElementFromHTML(RenGatewayContainerHTML());

        if (body[0] && popup) {
            body[0].insertBefore(popup, body[0].lastChild);
        }

        return getElement(`_ren_gatewayContainer`);
    }

    public static askForAddress = (token?: string) => {
        return `__renAskForAddress__${token ? token.toUpperCase() : ""}`;
    }

    private sendMessage = (type: string, payload: any) => {
        const frame = this.getIFrame();
        if (frame) {
            (frame as any).contentWindow.postMessage({ from: "ren", type, payload }, '*');
        }
    }


    public close = () => {
        try {
            const renElement = this.getPopup();
            if (renElement.parentElement) {
                renElement.parentElement.removeChild(renElement);
            }
        } catch (error) {
            console.error(error);
        }
    }

    private _pause = () => {
        this.paused = true;
        this.getPopup().classList.add("_ren_gateway-minified");
    }

    private _resume = () => {
        this.paused = false;
        this.getPopup().classList.remove("_ren_gateway-minified");
    }

    public pause = () => {
        this.sendMessage("pause", {});
        this._pause();
    }

    public resume = () => {
        this.sendMessage("resume", {});
        this._resume();
    }

    public open = async (params: Commitment) => new Promise((resolve, reject) => {

        // Check that GatewayJS isn't already open
        let existingPopup;
        try { existingPopup = this.getPopup(); } catch (error) { /* Ignore error */ }
        if (existingPopup) { throw new Error("GatewayJS already open"); }

        // Check if there's already a "_ren" element

        const container = this.getOrCreateGatewayContainer();

        const popup = createElementFromHTML(RenElementHTML(this.id, this.endpoint));

        if (popup) {
            container.insertBefore(popup, container.lastChild);
        }

        window.onmessage = (e: any) => {
            if (e.data && e.data.from === "ren") {
                console.log(`New message! ${e.data.type}`);
                // alert(`I got a message: ${JSON.stringify(e.data)}`);
                switch (e.data.type) {
                    case "ready":
                        this.sendMessage("shift", {
                            sendToken: params.sendToken,
                            sendTo: params.sendTo,
                            sendAmount: params.sendAmount,
                            contractFn: params.contractFn,
                            contractParams: params.contractParams,
                        });
                        if (this.paused) {
                            console.log(`Asking them to pause!!!`);
                            this.pause();
                        }
                        break;
                    case "pause":
                        this._pause();
                        break;
                    case "resume":
                        this._resume();
                        break;
                    case "cancel":
                        this.close();
                        reject(e.data.payload);
                        break;
                    case "done":
                        this.close();
                        resolve(e.data.payload);
                        break;
                }
            }
        };
    })
};

export default GatewayJS;
