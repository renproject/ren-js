import BigNumber from "bignumber.js";

import { BlockState, RenVMProvider } from "@renproject/provider";
import {
    Chain,
    ErrorWithCode,
    isDepositChain,
    RenJSError,
} from "@renproject/utils";

export { Gateway as LockAndMint } from "../gateway";

export const BIP_DENOMINATOR = 10000;

/**
 * GatewayFees provides the details of the fees charged by RenVM for a
 * particular gateway.
 */
export interface GatewayFees {
    /**
     * Locking or releasing on a deposit-based chain requires a fixed fee for
     * transferring the deposited amount from the gateway address to RenVM's
     * current MPC-shared key (for locks), or from this key to the recipient
     * for releases.
     * The fixed fee is zero when moving contract-based assets like ERC20s.
     */
    fixedFee: BigNumber;

    /**
     * The variable fee is based on the amount being transferred, represented
     * in basis points (BPS) - which is 1/100 of a percentage point.
     * e.g. 15 BPS represents 0.15%, or 15/10000.
     */
    variableFee: number;

    /**
     * The minimum amount to guarantee that RenVM will process the transaction.
     * Currently, it's calculated so that the transferred amount after fees is
     * greater than the dust amount for each chain, but in the future may
     * increase to ensure that the transaction is profitable for RenVM to
     * process.
     */
    minimumAmount: BigNumber;

    /**
     * Calculate the expected amount a user will receive if they send the
     * provided input amount, after subtracting both the fixed fee and the
     * variable fee.
     * If the input is smaller than the minimum-amount, `0` is returned.
     */
    estimateOutput: (input: BigNumber) => BigNumber;
}

export const estimateTransactionFee = async (
    renVM: RenVMProvider,
    asset: string,
    fromChain: Chain,
    toChain: Chain,
): Promise<GatewayFees> => {
    const blockState: BlockState = await renVM.queryBlockState(asset, 5);

    if (!blockState[asset]) {
        throw ErrorWithCode.updateError(
            new Error(`No fee details found for ${asset}`),
            RenJSError.UNKNOWN_ERROR,
        );
    }

    const {
        gasLimit,
        gasCap,
        minimumAmount: minimumBeforeFees,
        dustAmount,
    } = blockState[asset];

    const mintAndBurnFees = blockState[asset].fees.chains.filter(
        (chainFees) => chainFees.chain === toChain.chain,
    )[0];

    // Determine if the transaction is a lock-and-mint, burn-and-release or
    // burn-and-mint.
    const isLockAndMint = await fromChain.isLockAsset(asset);
    const isBurnAndRelease = await toChain.isLockAsset(asset);

    const requiresTransfer = isLockAndMint
        ? isDepositChain(fromChain) && (await fromChain.isDepositAsset(asset))
        : isBurnAndRelease
        ? isDepositChain(toChain) && (await toChain.isDepositAsset(asset))
        : false;

    const fixedFee = requiresTransfer
        ? gasLimit.times(gasCap).plus(dustAmount).plus(1)
        : new BigNumber(0);

    const mintFee =
        mintAndBurnFees && mintAndBurnFees.mintFee
            ? mintAndBurnFees.mintFee.toNumber()
            : 15;
    const burnFee =
        mintAndBurnFees && mintAndBurnFees.burnFee
            ? mintAndBurnFees.burnFee.toNumber()
            : 15;
    const variableFee = isLockAndMint
        ? mintFee
        : isBurnAndRelease
        ? burnFee
        : Math.floor(mintFee / 2 + burnFee / 2);

    const minimumAmount = minimumBeforeFees
        .plus(fixedFee)
        .times((isLockAndMint ? mintFee : burnFee) + BIP_DENOMINATOR)
        .dividedBy(BIP_DENOMINATOR)
        .decimalPlaces(0);

    const estimateOutput = (input: BigNumber | string | number): BigNumber => {
        const inputBN = new BigNumber(input);

        if (inputBN.isLessThan(minimumAmount)) {
            return new BigNumber(0);
        }

        if (isLockAndMint) {
            return BigNumber.max(
                inputBN
                    .minus(fixedFee)
                    .times(BIP_DENOMINATOR - variableFee)
                    .dividedBy(BIP_DENOMINATOR)
                    .decimalPlaces(0),
                0,
            );
        } else if (isBurnAndRelease) {
            return BigNumber.max(
                inputBN
                    .times(BIP_DENOMINATOR - variableFee)
                    .dividedBy(BIP_DENOMINATOR)
                    .minus(fixedFee)
                    .decimalPlaces(0),
                0,
            );
        } else {
            // Burn-and-mint transaction. If a fixed-fee is ever added for all
            // transactions, it will need to be added here.
            return BigNumber.max(
                inputBN
                    .times(BIP_DENOMINATOR - variableFee)
                    .dividedBy(BIP_DENOMINATOR)
                    .decimalPlaces(0),
                0,
            );
        }
    };

    return {
        fixedFee,
        variableFee,
        minimumAmount,
        estimateOutput,
    };
};
