import { randomNonce } from "./lib/utils";
import { ShifterNetwork } from "./renVM/shifterNetwork";
import { ShiftInObject } from "./shiftIn";
import { ShiftOutObject } from "./shiftOut";
import { Chain, Tokens } from "./types/assets";
import { Network, NetworkDetails, stringToNetwork } from "./types/networks";
import { ShiftInParams, ShiftOutParams } from "./types/parameters";

export * from "./renVM/renVMNetwork";
export * from "./renVM/transaction";
export * from "./blockchain/btc";
export * from "./blockchain/zec";
export * from "./blockchain/bch";
export * from "./blockchain/common";
export * from "./types/assets";
export * from "./types/networks";
export * from "./types/parameters";
export * from "./shiftIn";
export * from "./shiftOut";

export { UTXO } from "./lib/utils";

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
    public static Networks = Network;
    public static Chains = Chain;
    public static randomNonce = randomNonce;

    // Expose constants again without `static` so they can be accessed on
    // instances - e.g. `(new RenJS("testnet")).Tokens`
    public readonly Tokens = Tokens;
    public readonly Networks = Network;
    public readonly Chains = Chain;
    public readonly randomNonce = randomNonce;

    // Internal state
    private readonly network: NetworkDetails;
    private readonly renVMNetwork: ShifterNetwork;

    /**
     * Takes a Network object that contains relevant addresses.
     * @param network One of "mainnet" (or empty), "testnet" or a custom
     *                Network object.
     */
    constructor(network?: NetworkDetails | string | null | undefined) {
        this.network = stringToNetwork(network);
        this.renVMNetwork = new ShifterNetwork(this.network.nodeURLs);
    }

    /**
     * Submits the commitment and transaction to RenVM, and then submits the
     * signature to the adapter address.
     *
     * @param params See [[ShiftInParams]].
     * @returns An instance of [[ShiftInObject]].
     */
    public readonly shiftIn = (params: ShiftInParams): ShiftInObject => {
        return new ShiftInObject(this.renVMNetwork, this.network, params);
    }

    /**
     * Submits a burn log to RenVM.
     *
     * @param params See [[ShiftOutParams]].
     * @returns An instance of [[ShiftOutObject]].
     */
    public readonly shiftOut = (params: ShiftOutParams): ShiftOutObject => {
        return new ShiftOutObject(this.renVMNetwork, params);
    }
}

// tslint:disable: no-object-mutation
module.exports = RenJS;
module.exports.RenJS = RenJS;
module.exports.default = RenJS;
