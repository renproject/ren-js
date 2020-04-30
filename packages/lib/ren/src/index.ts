import _BN from "bn.js";

import {
    Asset, BurnAndReleaseParams, BurnAndReleaseParamsSimple, Chain, LockAndMintParams,
    LockAndMintParamsSimple, NetworkDetails, RenContract, RenNetwork, RenTokens, SendParams, Tokens,
} from "@renproject/interfaces";
import { MultiProvider, Provider } from "@renproject/provider";
import { RenVMParams, RenVMProvider, RenVMResponses } from "@renproject/rpc";
import {
    getGatewayAddress, getTokenAddress, NetworkChaosnet, NetworkTestnet, resolveSendCall,
    stringToNetwork, utils,
} from "@renproject/utils";
import Web3 from "web3";

import { BurnAndRelease } from "./burnAndRelease";
import { LockAndMint } from "./lockAndMint";

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
 * A second optional parameter lets you provide a RenVM RPC provider or a
 * lightnode URL.
 *
 * It then exposes two main functions:
 * 1. [[lockAndMint]] - for transferring assets to Ethereum.
 * 2. [[burnAndRelease]] - for transferring assets out of Ethereum.
 */
export default class RenJS {
    // Expose constants so they can be accessed on the RenJS class
    // e.g. `RenJS.Tokens`
    public static Tokens = Tokens;
    public static Networks = RenNetwork;
    public static NetworkDetails = NetworkDetails;
    public static Chains = Chain;
    public static utils: typeof utils = utils;

    // Not static
    public readonly utils: typeof utils = utils;
    public readonly renVM: RenVMProvider;
    public readonly network: NetworkDetails;

    /**
     * Takes a Network object that contains relevant addresses.
     * @param network One of "mainnet" (or empty), "testnet" or a custom
     *                Network object.
     */
    constructor(network?: NetworkDetails | string | null | undefined, provider?: string | Provider) {
        this.network = stringToNetwork(network);

        // Use provided provider, provider URL or default lightnode URL.
        const rpcProvider: Provider<RenVMParams, RenVMResponses> = ((provider && typeof provider !== "string") ?
            provider :
            new MultiProvider<RenVMParams, RenVMResponses>(
                provider ?
                    [provider] :
                    this.network.nodeURLs
            )
        ) as unknown as Provider<RenVMParams, RenVMResponses>;

        this.renVM = new RenVMProvider(rpcProvider);
    }

    /**
     * Submits the commitment and transaction to RenVM, and then submits the
     * signature to the adapter address.
     *
     * @param params See [[LockAndMintParams]].
     * @returns An instance of [[LockAndMint]].
     */
    public readonly lockAndMint = (params: LockAndMintParams | LockAndMintParamsSimple | SendParams): LockAndMint => {
        if ((params as SendParams).sendTo && !(params as LockAndMintParamsSimple).contractFn) {
            params = resolveSendCall(this.network, params as SendParams);
        } else if ((params as LockAndMintParamsSimple).sendTo) {
            const { sendTo, contractFn, contractParams, txConfig, ...restOfParams } = params as LockAndMintParamsSimple;
            params = { ...restOfParams, contractCalls: [{ sendTo, contractFn, contractParams, txConfig }] };
        }
        return new LockAndMint(this.renVM, this.network, params);
    }

    /**
     * Submits a burn log to RenVM.
     *
     * @param params See [[BurnAndReleaseParams]].
     * @returns An instance of [[BurnAndRelease]].
     */
    public readonly burnAndRelease = (params: BurnAndReleaseParams | BurnAndReleaseParamsSimple | SendParams): BurnAndRelease => {
        if ((params as SendParams).sendTo && !(params as BurnAndReleaseParamsSimple).contractFn) {
            params = resolveSendCall(this.network, params as SendParams);
        } else if ((params as LockAndMintParamsSimple).sendTo) {
            const { sendTo, contractFn, contractParams, txConfig, ...restOfParams } = params as BurnAndReleaseParamsSimple;
            params = { ...restOfParams, contractCalls: [{ sendTo, contractFn, contractParams, txConfig }] };
        }
        return new BurnAndRelease(this.renVM, this.network, params);
    }

    public readonly getTokenAddress = (web3: Web3, token: RenTokens | RenContract | Asset | ("BTC" | "ZEC" | "BCH")) => getTokenAddress(this.network, web3, token);
    public readonly getGatewayAddress = (web3: Web3, token: RenTokens | RenContract | Asset | ("BTC" | "ZEC" | "BCH")) => getGatewayAddress(this.network, web3, token);
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
