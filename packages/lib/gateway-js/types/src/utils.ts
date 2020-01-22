import { Network } from "./renJsCommon";

// For now, the endpoints are network specific.
export const GATEWAY_ENDPOINT = "https://gateway-staging.renproject.io/";
export const GATEWAY_ENDPOINT_CHAOSNET = "https://gateway.renproject.io/";

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

// const GATEWAY_URL = "http://localhost:3344/";

export const resolveEndpoint = (endpoint: Network | string) => {
    switch (endpoint) {
        case Network.Testnet:
            return GATEWAY_ENDPOINT;
        case Network.Chaosnet:
            return GATEWAY_ENDPOINT_CHAOSNET;
        case Network.Mainnet:
        case Network.Devnet:
        case Network.Localnet:
            throw new Error(`GatewayJS does not support the network ${endpoint} yet.`);
        default:
            return endpoint;
    }
};

export const randomBytes = (bytes: number) => {
    const uints = new Uint32Array(bytes / 4); // 4 bytes (32 bits)
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

export const utils = { randomNonce, askForAddress };
