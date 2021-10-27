import {
    Chain,
    InputType,
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
    if (await fromChain.assetIsNative(asset)) {
        return {
            inputType: InputType.Lock,
            outputType: OutputType.Mint,
            selector: `${asset}/to${toChain.chain}`,
        };
    } else if (await toChain.assetIsNative(asset)) {
        return {
            inputType: InputType.Burn,
            outputType: OutputType.Release,
            selector: `${asset}/from${fromChain.chain}`,
        };
    } else {
        throw withCode(
            new Error(`Burning and minting is not supported yet.`),
            RenJSError.NOT_IMPLEMENTED,
        );
        return {
            inputType: InputType.Burn,
            outputType: OutputType.Mint,
            selector: `${asset}/from${fromChain.chain}To${toChain.chain}`,
        };
    }
};
