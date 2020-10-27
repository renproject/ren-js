import { ContractCall, EthArg } from "@renproject/interfaces";

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

    return {
        ...contractCall,
        ...override,

        // Clone txConfig
        txConfig: { ...contractCall.txConfig, ...override.txConfig },

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
        throw new Error(
            `Contract call override must be same length as contract calls array.`,
        );
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
