import { ContractCall, EthArg } from "@renproject/interfaces";

export enum OverrideContractCallError {
    OverrideArrayLengthError = `Contract call override must be same length as contract calls array.`,
}

const overrideContractCall = (
    contractCall: ContractCall,
    override: ContractCallOverride,
) => {
    const overrideParams = (override.contractParams || []).reduce(
        (acc, param) => {
            if (param.name) {
                acc[param.name] = param;
            }
            return acc;
        },
        {},
    );

    let txConfig;
    if (
        typeof contractCall.txConfig === "object" &&
        typeof override.txConfig === "object"
    ) {
        txConfig = {
            ...contractCall.txConfig,
            ...override.txConfig,
        };
    } else {
        txConfig = override.txConfig || contractCall.txConfig;
    }

    return {
        ...contractCall,
        ...override,

        // Clone txConfig
        txConfig,

        // Clone contractParams
        contractParams: (contractCall.contractParams || []).map(
            (contractParam) => ({
                ...contractParam,
                ...overrideParams[contractParam.name],
            }),
        ),
    };
};

export type ContractCallOverride = Partial<
    Omit<ContractCall, "contractParams"> & {
        contractParams: Array<Partial<EthArg>>;
    }
>;

export const overrideContractCalls = (
    contractCalls: ContractCall[],
    override: ContractCallOverride | ContractCallOverride[],
): ContractCall[] => {
    if (Array.isArray(override) && override.length !== contractCalls.length) {
        throw new Error(OverrideContractCallError.OverrideArrayLengthError);
    }

    return contractCalls.map((contractCall, i) => {
        const contractCallOverride = Array.isArray(override)
            ? // If override is an array, there should be an array for each call.
              override[i]
            : // If there's only one override, apply it to the last contract call.
            i === contractCalls.length - 1
            ? override
            : // Default to empty object.
              {};
        return overrideContractCall(contractCall, contractCallOverride);
    });
};
