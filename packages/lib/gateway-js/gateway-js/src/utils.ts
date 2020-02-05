import { Network, value } from "@renproject/ren-js-common";

// For now, the endpoints are network specific.
export const GATEWAY_ENDPOINT_STAGING = "https://gateway-staging.renproject.io/";
export const GATEWAY_ENDPOINT_PRODUCTION = "https://gateway.renproject.io/";

export const sleep = async (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export const getElement = (id: string) => {
    const element = document.getElementById(id);
    if (!element) {
        throw new Error(`Unable to find element ${id}`);
    }
    return element;
};

export const createElementFromHTML = (htmlString: string) => {
    const div = document.createElement("div");
    // tslint:disable-next-line: no-object-mutation
    div.innerHTML = htmlString.trim();
    return div.firstChild;
};

export const resolveEndpoint = (endpointIn: string, network: Network | string, pathIn: string, shiftID?: string) => {
    // Remove ending '/' from endpoint
    const endpoint = endpointIn.slice(endpointIn.length - 1) === "/" ? endpointIn.slice(0, endpointIn.length - 1) : endpointIn;
    // Remove starting '/' from path
    const path = pathIn.slice(0, 1) === "/" ? pathIn.slice(1, pathIn.length) : pathIn;
    return `${endpoint}/#/${path}?network=${network}&${shiftID ? `id=${shiftID}` : ""}`;
};

export const randomBytes = (bytes: number) => {
    const uints = new Uint32Array(bytes / 4);
    window.crypto.getRandomValues(uints);
    let str = "";
    for (const uint of uints) {
        str += "0".repeat(8 - uint.toString(16).length) + uint.toString(16);
    }
    return "0x" + str;
};

const randomNonce = () => randomBytes(32);

const askForAddress = (token?: string) => {
    return `__renAskForAddress__${token ? token.toUpperCase() : ""}`;
};

export const utils = { randomNonce, askForAddress, value };
