import {
    BurnAndReleaseEvent, LockAndMintEvent, LockAndMintParams, NetworkDetails,
    SerializableTransferParams, TransferParams,
} from "@renproject/interfaces";
import { toFixed } from "@renproject/utils";

// For now, the endpoints are network specific.
export const GATEWAY_ENDPOINT_STAGING = "https://gateway-staging.renproject.io/";
export const GATEWAY_ENDPOINT_PRODUCTION = "https://renproject.github.io/gateway-staging.renproject.io/";

export const getElement = (id: string) => {
    const element = document.getElementById(id);
    if (!element) {
        throw new Error(`Unable to find element ${id}`);
    }
    return element;
};

export const createElementFromHTML = (htmlString: string) => {
    const div = document.createElement("div");
    // tslint:disable-next-line: no-object-mutation no-inner-html
    div.innerHTML = htmlString.trim();
    return div.firstChild;
};

export const resolveEndpoint = (endpointIn: string, network: NetworkDetails, pathIn: string, transferID?: string) => {
    // Remove ending '/' from endpoint
    const endpoint = endpointIn.slice(endpointIn.length - 1) === "/" ? endpointIn.slice(0, endpointIn.length - 1) : endpointIn;
    // Remove starting '/' from path
    const path = pathIn.slice(0, 1) === "/" ? pathIn.slice(1, pathIn.length) : pathIn;
    return `${endpoint}/#/${path}?network=${network.name}&${transferID ? `id=${transferID}` : ""}`;
};

// tslint:disable-next-line: readonly-keyword no-any
const fixBigNumber = <Value extends { [keys: string]: any }>(value: Value, key: keyof Value) => {
    try {
        // tslint:disable-next-line: strict-type-predicates
        if (value[key] && typeof value[key] === "object") {
            // tslint:disable-next-line: no-object-mutation no-any
            (value as any)[key] = toFixed(value[key]);
        }
    } catch (error) {
        // Ignore error - may be readonly value
    }
};

/**
 * prepareParamsForSendMessage turns possible BigNumber values into strings
 * before passing the params to sendMessage.
 * The error message `can't clone ...` is thrown if this step is skipped.
 * @param transferParamsIn The parameters being fixed.
 */
export const prepareParamsForSendMessage = (transferParamsIn: TransferParams | LockAndMintEvent | BurnAndReleaseEvent): SerializableTransferParams | LockAndMintEvent | BurnAndReleaseEvent => {
    // Certain types can't be sent via sendMessage - e.g. BigNumbers.

    const { web3Provider, ...transferParamsFiltered } = transferParamsIn as TransferParams;
    const transferParams = transferParamsFiltered as SerializableTransferParams;

    // tslint:disable-next-line: no-unnecessary-type-assertion
    fixBigNumber(transferParams as LockAndMintParams, "suggestedAmount");

    // Contract call values
    try {
        // tslint:disable-next-line: no-unnecessary-type-assertion
        const contractCalls = (transferParams as LockAndMintParams).contractCalls;
        if (contractCalls) {
            for (const contractCall of contractCalls) {
                const contractParamsInner = contractCall.contractParams;
                if (contractParamsInner) {
                    for (const contractParam of contractParamsInner) {
                        fixBigNumber(contractParam, "value");
                    }
                }
            }
        }
        // tslint:disable-next-line: no-console
    } catch (error) { console.error(error); }

    return transferParams;
};
