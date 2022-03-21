import {
    Chain,
    ErrorWithCode,
    InputType,
    isContractChain,
    OutputType,
    RenJSError,
} from "@renproject/utils";

/**
 * Detect whether the transaction is a lock-and-mint, burn-and-release or
 * burn-and-mint, and return the selector.
 */
export const getInputAndOutputTypes = async ({
    asset,
    fromChain,
    toChain,
}: {
    asset: string;
    fromChain: Chain;
    toChain: Chain;
}): Promise<{
    inputType: InputType;
    outputType: OutputType;
    selector: string;
}> => {
    if (await toChain.isLockAsset(asset)) {
        // Burn and release

        if (!isContractChain(fromChain)) {
            throw ErrorWithCode.updateError(
                new Error(
                    `Cannot burn from non-contract chain ${fromChain.chain}.`,
                ),
                RenJSError.PARAMETER_ERROR,
            );
        }
        if (!(await fromChain.isMintAsset(asset))) {
            throw ErrorWithCode.updateError(
                new Error(
                    `Asset '${asset}' is not supported on ${fromChain.chain}.`,
                ),
                RenJSError.PARAMETER_ERROR,
            );
        }
        return {
            inputType: InputType.Burn,
            outputType: OutputType.Release,
            selector: `${asset}/from${fromChain.chain}`,
        };
    } else if (await fromChain.isLockAsset(asset)) {
        // Lock and mint

        if (!isContractChain(toChain)) {
            throw ErrorWithCode.updateError(
                new Error(
                    `Cannot mint to non-contract chain ${toChain.chain}.`,
                ),
                RenJSError.PARAMETER_ERROR,
            );
        }
        if (!(await toChain.isMintAsset(asset))) {
            throw ErrorWithCode.updateError(
                new Error(
                    `Asset '${asset}' is not supported on ${toChain.chain}.`,
                ),
                RenJSError.PARAMETER_ERROR,
            );
        }
        return {
            inputType: InputType.Lock,
            outputType: OutputType.Mint,
            selector: `${asset}/to${toChain.chain}`,
        };
    } else {
        // Burn and mint

        if (!isContractChain(toChain)) {
            throw ErrorWithCode.updateError(
                new Error(
                    `Cannot mint to non-contract chain ${toChain.chain}.`,
                ),
                RenJSError.PARAMETER_ERROR,
            );
        }
        if (!(await toChain.isMintAsset(asset))) {
            throw ErrorWithCode.updateError(
                new Error(
                    `Asset '${asset}' is not supported on ${toChain.chain}.`,
                ),
                RenJSError.PARAMETER_ERROR,
            );
        }

        if (!isContractChain(fromChain)) {
            throw ErrorWithCode.updateError(
                new Error(
                    `Cannot burn from non-contract chain ${fromChain.chain}.`,
                ),
                RenJSError.PARAMETER_ERROR,
            );
        }
        if (!(await fromChain.isMintAsset(asset))) {
            throw ErrorWithCode.updateError(
                new Error(
                    `Asset '${asset}' is not supported on ${fromChain.chain}.`,
                ),
                RenJSError.PARAMETER_ERROR,
            );
        }

        return {
            inputType: InputType.Burn,
            outputType: OutputType.Mint,
            selector: `${asset}/from${fromChain.chain}_to${toChain.chain}`,
        };
    }
};
