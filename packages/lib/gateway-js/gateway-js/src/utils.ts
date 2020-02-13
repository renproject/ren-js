import {
    BurnContractCallSimple, GatewayParams, GatewayShiftInParamsExtra, RenNetwork,
    ShiftInFromDetails, toFixed,
} from "@renproject/ren-js-common";

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

export const resolveEndpoint = (endpointIn: string, network: RenNetwork | string, pathIn: string, shiftID?: string) => {
    // Remove ending '/' from endpoint
    const endpoint = endpointIn.slice(endpointIn.length - 1) === "/" ? endpointIn.slice(0, endpointIn.length - 1) : endpointIn;
    // Remove starting '/' from path
    const path = pathIn.slice(0, 1) === "/" ? pathIn.slice(1, pathIn.length) : pathIn;
    return `${endpoint}/#/${path}?network=${network}&${shiftID ? `id=${shiftID}` : ""}`;
};

/**
 * prepareParamsForSendMessage turns possible BigNumber values into strings
 * before passing the params to sendMessage.
 * The error message `can't clone ...` is thrown if this step is skipped.
 * @param shiftParams The parameters being fixed.
 */
export const prepareParamsForSendMessage = (shiftParams: GatewayParams): GatewayParams => {
    // Certain types can't be sent via sendMessage - e.g. BigNumbers.
    try {
        // tslint:disable-next-line: no-any no-object-mutation no-unnecessary-type-assertion
        if (typeof (shiftParams as BurnContractCallSimple).sendAmount === "object") {
            // tslint:disable-next-line: no-any no-object-mutation no-unnecessary-type-assertion
            (shiftParams as BurnContractCallSimple).sendAmount = toFixed((shiftParams as BurnContractCallSimple).sendAmount);
        }
    } catch (error) { console.error(error); }
    try {
        // tslint:disable-next-line: no-any no-object-mutation no-unnecessary-type-assertion
        if (typeof (shiftParams as GatewayShiftInParamsExtra).suggestedAmount === "object") {
            // tslint:disable-next-line: no-any no-object-mutation no-unnecessary-type-assertion
            (shiftParams as GatewayShiftInParamsExtra).suggestedAmount = toFixed((shiftParams as GatewayShiftInParamsExtra).suggestedAmount);
        }
    } catch (error) { console.error(error); }
    try {
        // tslint:disable-next-line: no-any no-object-mutation no-unnecessary-type-assertion
        const requiredAmount = (shiftParams as ShiftInFromDetails).requiredAmount;
        if (typeof requiredAmount === "object") {
            // tslint:disable-next-line: no-any readonly-keyword no-unnecessary-type-assertion
            const min = (requiredAmount as { max: any, min: any }).min;
            // tslint:disable-next-line: no-any readonly-keyword no-unnecessary-type-assertion
            const max = (requiredAmount as { max: any, min: any }).max;
            if (min || max) {
                // tslint:disable-next-line: no-object-mutation no-unnecessary-type-assertion
                (shiftParams as ShiftInFromDetails).requiredAmount = {
                    min: min ? toFixed(min) : undefined,
                    max: max ? toFixed(max) : undefined,
                };
            } else {
                // tslint:disable-next-line: no-object-mutation no-any no-unnecessary-type-assertion
                (shiftParams as ShiftInFromDetails).requiredAmount = toFixed((shiftParams as ShiftInFromDetails).requiredAmount as any);
            }
        }
    } catch (error) { console.error(error); }

    return shiftParams;
};
