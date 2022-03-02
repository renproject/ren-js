import { Marshalled, PackPrimitive } from "@renproject/utils";

// ParamsQueryConfig defines the parameters of the MethodQueryConfig.
export interface ParamsQueryConfig {
    // No parameters.
}

// Responses ///////////////////////////////////////////////////////////////////

// ResponseQueryConfig defines the response of the MethodQueryConfig.
export interface ResponseQueryConfig {
    confirmations: {
        [chain: string]: Marshalled<PackPrimitive.U64>;
    };
    maxConfirmations: {
        [chain: string]: Marshalled<PackPrimitive.U64>;
    };
    network: string;
    registries: {
        [chain: string]: string;
    };
    whitelist: string[];
}
