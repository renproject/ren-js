import _BN from "bn.js";

import {
    Asset, Chain, RenContract, RenNetwork, SendParams, ShiftedToken, ShiftInParams,
    ShiftInParamsSimple, ShiftOutParams, ShiftOutParamsSimple, Tokens,
} from "@renproject/interfaces";
import { MultiProvider, Provider } from "@renproject/provider";
import { RenVMParams, RenVMProvider, RenVMResponses } from "@renproject/rpc";
import {
    getShifterAddress, getTokenAddress, NetworkChaosnet, NetworkDetails, NetworkTestnet,
    resolveSendCall, stringToNetwork, utils,
} from "@renproject/utils";
import Web3 from "web3";

import { ShifterNetwork } from "./shifterNetwork";
import { ShiftIn } from "./shiftIn";
import { ShiftOut } from "./shiftOut";

const NetworkDetails = {
    NetworkChaosnet,
    NetworkTestnet,
    stringToNetwork,
};

/**
 * This is the main exported class.
 *
 * ```typescript
 * import RenJS from "@renproject/ren";
 * ```
 *
 * It's initialized with a network, which controls both the RenVM network and
 * Ethereum chain to use:
 *
 * ```typescript
 * new RenJS(); // Same as `new RenJS("mainnet");`
 * new RenJS("testnet");
 * new RenJS({ ...NetworkMainnet, lightnodeURL: "custom lightnode URL" });
 * ```
 *
 * It then exposes two main functions: [[shiftIn]] and [[shiftOut]].
 */
export default class RenJS {
    // Expose constants so they can be accessed on the RenJS class
    // e.g. `RenJS.Tokens`
    public static Tokens = Tokens;
    public static Networks = RenNetwork;
    public static NetworkDetails = NetworkDetails;
    public static Chains = Chain;
    public static utils = utils;

    // Not static
    public readonly utils = utils;
    public readonly renVM: ShifterNetwork;
    public readonly lightnode: RenVMProvider;
    public readonly network: NetworkDetails;

    /**
     * Takes a Network object that contains relevant addresses.
     * @param network One of "mainnet" (or empty), "testnet" or a custom
     *                Network object.
     */
    constructor(network?: NetworkDetails | string | null | undefined, provider?: string | Provider) {
        this.network = stringToNetwork(network);
        const rpcProvider: Provider<RenVMParams, RenVMResponses> = ((provider && typeof provider !== "string") ? provider : new MultiProvider<RenVMParams, RenVMResponses>(provider ? [provider] : this.network.nodeURLs)) as unknown as Provider<RenVMParams, RenVMResponses>;
        this.lightnode = new RenVMProvider(rpcProvider);
        this.renVM = new ShifterNetwork(this.lightnode);
    }

    /**
     * Submits the commitment and transaction to RenVM, and then submits the
     * signature to the adapter address.
     *
     * @param params See [[ShiftInParams]].
     * @returns An instance of [[ShiftInObject]].
     */
    public readonly shiftIn = (params: ShiftInParams | ShiftInParamsSimple | SendParams): ShiftIn => {
        if ((params as SendParams).sendAmount) {
            params = resolveSendCall(this.network, params as SendParams);
        } else if ((params as ShiftInParamsSimple).sendTo) {
            const { sendTo, contractFn, contractParams, txConfig, ...restOfParams } = params as ShiftInParamsSimple;
            params = { ...restOfParams, contractCalls: [{ sendTo, contractFn, contractParams, txConfig }] };
        }
        return new ShiftIn(this.renVM, this.network, params);
    }

    /**
     * Submits a burn log to RenVM.
     *
     * @param params See [[ShiftOutParams]].
     * @returns An instance of [[ShiftOutObject]].
     */
    public readonly shiftOut = (params: ShiftOutParams | ShiftOutParamsSimple | SendParams): ShiftOut => {
        if ((params as SendParams).sendAmount) {
            params = resolveSendCall(this.network, params as SendParams);
        } else if ((params as ShiftInParamsSimple).sendTo) {
            const { sendTo, contractFn, contractParams, txConfig, ...restOfParams } = params as ShiftOutParamsSimple;
            params = { ...restOfParams, contractCalls: [{ sendTo, contractFn, contractParams, txConfig }] };
        }

        return new ShiftOut(this.renVM, this.network, params);
    }

    public readonly getTokenAddress = (web3: Web3, token: ShiftedToken | RenContract | Asset | ("BTC" | "ZEC" | "BCH")) => getTokenAddress(this.network, web3, token);
    public readonly getShifterAddress = (web3: Web3, token: ShiftedToken | RenContract | Asset | ("BTC" | "ZEC" | "BCH")) => getShifterAddress(this.network, web3, token);
}


////////////////////////////////////////////////////////////////////////////////
// EXPORTS                                                                    //
// Based on https://github.com/MikeMcl/bignumber.js/blob/master/bignumber.js  //
////////////////////////////////////////////////////////////////////////////////

// tslint:disable: no-any no-object-mutation strict-type-predicates no-typeof-undefined

// tslint:disable-next-line: no-string-literal
(RenJS as any)["default"] = (RenJS as any).RenJS = RenJS;

// AMD
try {
    // @ts-ignore
    if (typeof define === "function" && define.amd) { define(() => RenJS); }
} catch (error) { /* ignore */ }

// Node.js and other environments that support module.exports.
try { // @ts-ignore
    if (typeof module !== "undefined" && module.exports) { module.exports = RenJS; }
} catch (error) { /* ignore */ }

// Browser.
try {
    // @ts-ignore
    if (typeof window !== "undefined" && window) { (window as any).RenJS = RenJS; }
} catch (error) { /* ignore */ }
