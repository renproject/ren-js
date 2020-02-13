// tslint:disable: no-mixed-interface

export { BigNumber } from "bignumber.js";

import { PromiEvent } from "../utils/promiEvent";
import { randomBytes } from "../utils/utils";
import { value } from "../utils/value";
import { GatewayParams } from "./parameters/parameters";
import { Chain, RenNetwork, Tokens } from "./renVM";
import { HistoryEvent, ShiftInStatus, ShiftOutStatus } from "./types";
import { UnmarshalledTx } from "./unmarshalled";

// Utils

export const gatewayUtils = {
    randomNonce: () => randomBytes(32),
    askForAddress: (token?: string) => `__renAskForAddress__${token ? token.toUpperCase() : ""}`,
    value
};

// GatewayJS ///////////////////////////////////////////////////////////////////

export interface GatewayJSConstructor {
    new(network: RenNetwork | string, options?: { endpoint?: string }): GatewayJSInterface;

    // Static values
    Tokens: typeof Tokens;
    Networks: typeof RenNetwork;
    Chains: typeof Chain;
    ShiftInStatus: typeof ShiftInStatus;
    ShiftOutStatus: typeof ShiftOutStatus;
    utils: typeof gatewayUtils;
}

export interface GatewayJSInterface {
    readonly getGateways: () => Promise<Map<string, HistoryEvent>>;
    readonly open: (params: GatewayParams) => GatewayInstance;
}

// Gateway class - returned from gatewayJS.open ////////////////////////////////

export interface GatewayConstructor {
    new(network: RenNetwork | string, endpoint: string): GatewayInstance;

    // Static values
    Tokens: typeof Tokens;
    Networks: typeof RenNetwork;
    Chains: typeof Chain;
    ShiftInStatus: typeof ShiftInStatus;
    ShiftOutStatus: typeof ShiftOutStatus;
    utils: typeof gatewayUtils;
}

export interface GatewayInstance {
    readonly isPaused: boolean;
    readonly isOpen: boolean;

    readonly close: () => void;
    readonly pause: () => Promise<GatewayInstance>;
    readonly resume: () => Promise<GatewayInstance>;
    readonly cancel: () => Promise<GatewayInstance>;
    readonly getStatus: () => Promise<ShiftInStatus | ShiftOutStatus>;
    // tslint:disable-next-line: no-any
    readonly result: () => PromiEvent<UnmarshalledTx | {}, { status: [ShiftInStatus | ShiftOutStatus, any] }>;

    // Should not called on GatewayJS instead.
    readonly _getGateways: () => Promise<Map<string, HistoryEvent>>;
    readonly _open: (shiftParams: GatewayParams) => GatewayInstance;
}
