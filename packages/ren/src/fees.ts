import BigNumber from "bignumber.js";

import { BlockState, RenVMProvider } from "@renproject/provider";
import {
    Chain,
    RenJSError,
    unmarshalTypedPackValue,
    withCode,
} from "@renproject/utils";

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
    const blockState: BlockState = await renVM.queryBlockState(5);

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

    const isLockAndMint = await fromChain.isLockAsset(asset);

    const mintFee =
        mintAndBurnFees && mintAndBurnFees.mintFee
            ? mintAndBurnFees.mintFee.toNumber()
            : 15;
    const burnFee =
        mintAndBurnFees && mintAndBurnFees.burnFee
            ? mintAndBurnFees.burnFee.toNumber()
            : 15;

    /**
     * Calculate the expected amount a user will receive if they send the input
     * amount.
     */
    const estimateOutput = (input: BigNumber | string | number): BigNumber => {
        if (isLockAndMint) {
            return new BigNumber(input)
                .minus(transferFee)
                .times(BIP_DENOMINATOR - mintFee)
                .dividedBy(BIP_DENOMINATOR)
                .decimalPlaces(0);
        }
        return new BigNumber(input)
            .times(BIP_DENOMINATOR - burnFee)
            .dividedBy(BIP_DENOMINATOR)
            .minus(transferFee)
            .decimalPlaces(0);
    };

    const minimumDeposit = minimumAmount
        .plus(transferFee)
        .plus(dustAmount.plus(1))
        .times((isLockAndMint ? mintFee : burnFee) + BIP_DENOMINATOR)
        .dividedBy(BIP_DENOMINATOR)
        .decimalPlaces(0);

    return {
        lock: transferFee,
        release: transferFee,

        mint: mintFee,
        burn: burnFee,

        minimumAmount: minimumDeposit,
        estimateOutput,
    };
};
