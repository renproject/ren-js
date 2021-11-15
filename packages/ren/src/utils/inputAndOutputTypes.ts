import {
    Chain,
    InputType,
    isContractChain,
    OutputType,
    RenJSError,
    withCode,
} from "@renproject/utils";

/**
 * Detect whether the transaction is a lock-and-mint, burn-and-release or
 * burn-and-mint.
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
        if (!isContractChain(fromChain)) {
            throw withCode(
                new Error(
                    `Cannot burn from non-contract chain ${fromChain.chain}.`,
                ),
                RenJSError.PARAMETER_ERROR,
            );
        }
        if (!(await fromChain.isMintAsset(asset))) {
            throw withCode(
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
        if (!isContractChain(toChain)) {
            throw withCode(
                new Error(
                    `Cannot mint to non-contract chain ${toChain.chain}.`,
                ),
                RenJSError.PARAMETER_ERROR,
            );
        }
        if (!(await toChain.isMintAsset(asset))) {
            throw withCode(
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
        throw withCode(
            new Error(`Burning and minting is not supported yet.`),
            RenJSError.NOT_IMPLEMENTED,
        );

        // if (!isContractChain(toChain)) {
        //     throw withCode(
        //         new Error(
        //             `Cannot mint to non-contract chain ${toChain.chain}.`,
        //         ),
        //         RenJSError.PARAMETER_ERROR,
        //     );
        // }
        // if (!(await toChain.isMintAsset(asset))) {
        //     throw withCode(
        //         new Error(
        //             `Asset '${asset}' is not supported on ${toChain.chain}.`,
        //         ),
        //         RenJSError.PARAMETER_ERROR,
        //     );
        // }

        // if (!isContractChain(fromChain)) {
        //     throw withCode(
        //         new Error(
        //             `Cannot burn from non-contract chain ${fromChain.chain}.`,
        //         ),
        //         RenJSError.PARAMETER_ERROR,
        //     );
        // }
        // if (!(await fromChain.isMintAsset(asset))) {
        //     throw withCode(
        //         new Error(
        //             `Asset '${asset}' is not supported on ${fromChain.chain}.`,
        //         ),
        //         RenJSError.PARAMETER_ERROR,
        //     );
        // }

        // return {
        //     inputType: InputType.Burn,
        //     outputType: OutputType.Mint,
        //     selector: `${asset}/from${fromChain.chain}To${toChain.chain}`,
        // };
    }
};
