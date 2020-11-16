/**
 * The `value` function converts between different cryptocurrency units.
 * See `value.spec.ts` for example usage.
 */

import { NumberValue } from "@renproject/interfaces";
import BigNumber from "bignumber.js";

const toBigNumber = (valueIn: NumberValue): BigNumber =>
    BigNumber.isBigNumber(valueIn)
        ? new BigNumber(valueIn)
        : new BigNumber(valueIn.toString());

export const toSmallestUnit = (value: NumberValue, decimals: number): string =>
    toBigNumber(value)
        .times(new BigNumber(10).exponentiatedBy(decimals))
        .toFixed();

export const fromSmallestUnit = (
    value: NumberValue,
    decimals: number,
): string =>
    toBigNumber(value)
        .dividedBy(new BigNumber(10).exponentiatedBy(decimals))
        .toFixed();
