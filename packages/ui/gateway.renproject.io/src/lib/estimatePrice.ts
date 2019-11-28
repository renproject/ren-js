import BigNumber from "bignumber.js";

import { Token } from "../state/generalTypes";
import { ReserveBalances } from "../state/uiContainer";

const feeInBIPs = 20;

export const removeRenVMFee = (rcvAmount: BigNumber) =>
    rcvAmount
        .times(10000 - feeInBIPs)
        .div(10000);

export const recoverRenVMFee = (dstAmount: BigNumber) =>
    dstAmount
        .times(10000)
        .div(10000 - feeInBIPs)
        .minus(dstAmount);

export const estimatePrice = async (srcToken: Token, dstToken: Token, sendAmount: BigNumber, reserves: ReserveBalances | undefined): Promise<BigNumber> => {
    if (!reserves) {
        return new BigNumber(0);
    }

    const srcAmount = reserves.get(srcToken);
    const dstAmount = reserves.get(dstToken);

    if (srcAmount === undefined || dstAmount === undefined) {
        console.debug("srcAmount or dstAmount undefined");
        return new BigNumber(0);
    }

    const rcvAmount = dstAmount.minus((srcAmount.times(dstAmount).div(srcAmount.plus(sendAmount))));
    return removeRenVMFee(rcvAmount);
};
