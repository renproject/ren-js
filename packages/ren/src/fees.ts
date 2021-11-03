import BigNumber from "bignumber.js";

import { RenVMProvider, unmarshalTypedPackValue } from "@renproject/provider";
import { Chain, RenJSError, withCode } from "@renproject/utils";

import { BlockState } from "../../provider/build/main/methods/ren_queryBlockState";

export { Gateway as LockAndMint } from "./gateway";

export const BIP_DENOMINATOR = 10000;

export interface GatewayFees {
    lock: BigNumber;
    release: BigNumber;
    mint: number;
    burn: number;
    minimumAmount: BigNumber;
    estimateOutput: (input: BigNumber) => BigNumber;
}

export const estimateTransactionFee = async (
    renVM: RenVMProvider,
    asset: string,
    fromChain: Chain,
    toChain: Chain,
): Promise<GatewayFees> => {
    const renVMState = await renVM.queryBlockState();

    const blockState: BlockState = unmarshalTypedPackValue(renVMState.state);

    if (!blockState[asset]) {
        throw withCode(
            new Error(`No fee details found for ${asset}`),
            RenJSError.UNKNOWN_ERROR,
        );
    }

    const { gasLimit, gasCap, minimumAmount, dustAmount } = blockState[asset];
    const transferFee = gasLimit.times(gasCap);

    const mintAndBurnFees = blockState[asset].fees.chains.filter(
        (chainFees) => chainFees.chain === toChain.chain,
    )[0];

    const lockAndMint = await fromChain.assetIsNative(asset);

    const mintFee =
        mintAndBurnFees && mintAndBurnFees.mintFee
            ? mintAndBurnFees.mintFee.toNumber()
            : 15;
    const burnFee =
        mintAndBurnFees && mintAndBurnFees.burnFee
            ? mintAndBurnFees.burnFee.toNumber()
            : 15;

    const estimateOutput = (input: BigNumber | string | number): BigNumber => {
        if (lockAndMint) {
            return new BigNumber(input)
                .minus(transferFee)
                .times(BIP_DENOMINATOR - mintFee)
                .dividedBy(BIP_DENOMINATOR);
        }
        return new BigNumber(input)
            .times(BIP_DENOMINATOR - burnFee)
            .dividedBy(BIP_DENOMINATOR)
            .minus(transferFee);
    };

    const minimumDeposit = minimumAmount
        .plus(transferFee)
        .plus(dustAmount.plus(1))
        .times((lockAndMint ? mintFee : burnFee) + BIP_DENOMINATOR)
        .dividedBy(BIP_DENOMINATOR);

    return {
        lock: transferFee,
        release: transferFee,

        mint: mintFee,
        burn: burnFee,

        minimumAmount: minimumDeposit,
        estimateOutput,
    };
};
