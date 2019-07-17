import { RenVMNetwork } from "./renVM/renVMNetwork";
import { ShiftInObject } from "./shiftIn";
import { ShiftOutObject } from "./shiftOut";
import { Chain, Tokens } from "./types/assets";
import { Network, NetworkDetails, stringToNetwork } from "./types/networks";
import { ShiftInParams, ShiftOutParams } from "./types/parameters";

export * from "./renVM/renVMNetwork";
export * from "./blockchain/btc";
export * from "./blockchain/zec";
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
 * import RenVM from "@renproject/ren";
 * ```
 *
 * It's initialized with a network, which controls both the RenVM network and
 * Ethereum chain to use:
 *
 * ```typescript
 * new RenVM(); // Same as `new RenVM("mainnet");`
 * new RenVM("testnet");
 * new RenVM({ ...NetworkMainnet, lightnodeURL: "custom lightnode URL" });
 * ```
 *
 * It then exposes two main functions: [[shiftIn]] and [[shiftOut]].
 */
export default class RenVM {
    // Expose constants so they can be accessed on the RenVM class
    // e.g. `RenVM.Tokens`
    public static Tokens = Tokens;
    public static Networks = Network;
    public static Chains = Chain;

    // Expose constants again without `static` so they can be accessed on
    // instances - e.g. `(new RenVM()).Tokens`
    public Tokens = Tokens;
    public Networks = Network;
    public Chains = Chain;

    // Internal state
    private readonly network: NetworkDetails;
    private readonly renVMNetwork: RenVMNetwork;

    /**
     * Takes a Network object that contains relevant addresses.
     * @param network One of "mainnet" (or empty), "testnet" or a custom
     *                Network object.
     */
    constructor(network?: NetworkDetails | string | null | undefined) {
        this.network = stringToNetwork(network);
        this.renVMNetwork = new RenVMNetwork(this.network.nodeURLs);
    }

    /**
     * Submits the commitment and transaction to RenVM, and then submits the
     * signature to the adapter address.
     *
     * @param params See [[ShiftInParams]].
     * @returns An instance of [[ShiftInObject]].
     */
    public shiftIn = (params: ShiftInParams): ShiftInObject => {
        return new ShiftInObject(this.renVMNetwork, this.network, params);
    }

    /**
     * Submits a burn log to RenVM.
     *
     * @param params See [[ShiftOutParams]].
     * @returns An instance of [[ShiftOutObject]].
     */
    public shiftOut = (params: ShiftOutParams): ShiftOutObject => {
        return new ShiftOutObject(this.renVMNetwork, params);
    }
}
