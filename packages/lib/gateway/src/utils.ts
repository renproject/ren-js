import {
    RenNetwork, SerializableShiftParams, ShiftInEvent, ShiftInParams, ShiftOutEvent, ShiftParams,
    toFixed,
} from "@renproject/interfaces";
import { NetworkDetails } from "@renproject/utils";

// For now, the endpoints are network specific.
export const GATEWAY_ENDPOINT_STAGING = "https://gateway-staging.renproject.io/";
export const GATEWAY_ENDPOINT_PRODUCTION = "https://gateway.renproject.io/";

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

export const resolveEndpoint = (endpointIn: string, network: NetworkDetails, pathIn: string, shiftID?: string) => {
    // Remove ending '/' from endpoint
    const endpoint = endpointIn.slice(endpointIn.length - 1) === "/" ? endpointIn.slice(0, endpointIn.length - 1) : endpointIn;
    // Remove starting '/' from path
    const path = pathIn.slice(0, 1) === "/" ? pathIn.slice(1, pathIn.length) : pathIn;
    return `${endpoint}/#/${path}?network=${network.name}&${shiftID ? `id=${shiftID}` : ""}`;
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
 * @param shiftParams The parameters being fixed.
 */
export const prepareParamsForSendMessage = (shiftParamsIn: ShiftParams | ShiftInEvent | ShiftOutEvent): SerializableShiftParams | ShiftInEvent | ShiftOutEvent => {
    // Certain types can't be sent via sendMessage - e.g. BigNumbers.

    if (!(shiftParamsIn as ShiftParams).web3Provider) {
        return shiftParamsIn as ShiftInEvent | ShiftOutEvent;
    }

    const { web3Provider, ...shiftParamsFiltered } = shiftParamsIn as ShiftParams;
    const shiftParams = shiftParamsFiltered as SerializableShiftParams;

    // tslint:disable-next-line: no-unnecessary-type-assertion
    fixBigNumber(shiftParams as ShiftInParams, "suggestedAmount");

    // Required amount
    try {
        // tslint:disable-next-line: no-any no-object-mutation no-unnecessary-type-assertion
        const requiredAmount = (shiftParams as ShiftInParams).requiredAmount;
        if (typeof requiredAmount === "object") {
            // tslint:disable-next-line: no-any readonly-keyword no-unnecessary-type-assertion
            const min = (requiredAmount as { max: any, min: any }).min;
            // tslint:disable-next-line: no-any readonly-keyword no-unnecessary-type-assertion
            const max = (requiredAmount as { max: any, min: any }).max;
            if (min || max) {
                // tslint:disable-next-line: no-object-mutation no-unnecessary-type-assertion
                (shiftParams as ShiftInParams).requiredAmount = {
                    min: min ? toFixed(min) : undefined,
                    max: max ? toFixed(max) : undefined,
                };
            } else {
                // tslint:disable-next-line: no-unnecessary-type-assertion
                fixBigNumber(shiftParams as ShiftInParams, "requiredAmount");
            }
        }
    } catch (error) { console.error(error); }

    // Contract call values
    try {
        // tslint:disable-next-line: no-unnecessary-type-assertion
        const contractCalls = (shiftParams as ShiftInParams).contractCalls;
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
    } catch (error) { console.error(error); }

    return shiftParams;
};
