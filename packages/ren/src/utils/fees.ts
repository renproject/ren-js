import BigNumber from "bignumber.js";

import { RenVMProvider } from "@renproject/provider";
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
    estimateOutput: (
        input:
            | BigNumber
            | string
            | number
            | { amount: string; convertUnit?: boolean },
    ) => BigNumber;
}

// Some assets may have their gas price defined in a different unit.
const assetGasDivisors = {
    LUNA: 5,
};

export const estimateTransactionFee = async (
    renVM: RenVMProvider,
    asset: string,
    fromChain: Chain,
    toChain: Chain,
): Promise<GatewayFees> => {
    // Determine if the transaction is a lock-and-mint, burn-and-release or
    // burn-and-mint.
    const [
        blockState,
        isLockAndMint,
        isBurnAndRelease,
        decimalsOnFromChain,
        decimalsOnToChain,
    ] = await Promise.all([
        renVM.queryBlockState(asset, 5),
        fromChain.isLockAsset(asset),
        toChain.isLockAsset(asset),

        fromChain.assetDecimals(asset),
        toChain.assetDecimals(asset),
    ]);

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

    // No other way of getting proper decimals for burn-and-mints.
    const nativeDecimals = Math.max(decimalsOnFromChain, decimalsOnToChain);

    const requiresTransfer = isLockAndMint
        ? isDepositChain(fromChain) && (await fromChain.isDepositAsset(asset))
        : isBurnAndRelease
        ? isDepositChain(toChain) && (await toChain.isDepositAsset(asset))
        : false;

    const fixedFee = requiresTransfer
        ? gasLimit
              .times(gasCap)
              .shiftedBy(-assetGasDivisors[asset] || 0)
              .plus(dustAmount)
              .plus(1)
        : new BigNumber(0);

    const mintFee =
        mintAndBurnFees && mintAndBurnFees.mintFee
            ? mintAndBurnFees.mintFee.toNumber()
            : 15;
    const burnFee =
        mintAndBurnFees && mintAndBurnFees.burnFee
            ? mintAndBurnFees.burnFee.toNumber()
            : 15;
    const burnAndMintFee =
        mintAndBurnFees && mintAndBurnFees.burnAndMintFee
            ? mintAndBurnFees.burnAndMintFee.toNumber()
            : 15;
    const variableFee: number = isLockAndMint
        ? mintFee
        : isBurnAndRelease
        ? burnFee
        : burnAndMintFee;

    const minimumAmount = minimumBeforeFees
        .plus(fixedFee)
        .times(variableFee + BIP_DENOMINATOR)
        .dividedBy(BIP_DENOMINATOR)
        .decimalPlaces(0);

    const estimateOutput = (
        input:
            | BigNumber
            | string
            | number
            | { amount: string; convertUnit?: boolean },
    ): BigNumber => {
        const amount = BigNumber.isBigNumber(input)
            ? input
            : typeof input === "string"
            ? input
            : typeof input === "number"
            ? input
            : input.amount;
        const convertUnit =
            typeof input === "object" && !BigNumber.isBigNumber(input)
                ? input.convertUnit || false
                : false;

        const amountBN = new BigNumber(amount).shiftedBy(
            convertUnit ? nativeDecimals : 0,
        );

        if (amountBN.isLessThan(minimumAmount)) {
            return new BigNumber(0);
        }

        if (isLockAndMint) {
            return BigNumber.max(
                amountBN
                    .minus(fixedFee)
                    .times(BIP_DENOMINATOR - variableFee)
                    .dividedBy(BIP_DENOMINATOR)
                    .decimalPlaces(0),
                0,
            ).shiftedBy(convertUnit ? -nativeDecimals : 0);
        } else if (isBurnAndRelease) {
            return BigNumber.max(
                amountBN
                    .times(BIP_DENOMINATOR - variableFee)
                    .dividedBy(BIP_DENOMINATOR)
                    .minus(fixedFee)
                    .decimalPlaces(0),
                0,
            ).shiftedBy(convertUnit ? -nativeDecimals : 0);
        } else {
            // Burn-and-mint transaction. If a fixed-fee is ever added for all
            // transactions, it will need to be added here.
            return BigNumber.max(
                amountBN
                    .times(BIP_DENOMINATOR - variableFee)
                    .dividedBy(BIP_DENOMINATOR)
                    .decimalPlaces(0),
                0,
            ).shiftedBy(convertUnit ? -nativeDecimals : 0);
        }
    };

    return {
        fixedFee,
        variableFee,
        minimumAmount,
        estimateOutput,
    };
};
