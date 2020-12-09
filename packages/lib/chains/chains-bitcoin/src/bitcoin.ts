import { LockChain, MintChainStatic } from "@renproject/interfaces";
import { assertType, Callable } from "@renproject/utils";
import BigNumber from "bignumber.js";

import {
    BtcAddress,
    BitcoinBaseChain,
    BtcNetwork,
    BtcDeposit,
    BtcTransaction,
} from "./base";

/**
 * The Bitcoin class adds support for the asset BTC.
 */
export class BitcoinClass extends BitcoinBaseChain
    implements
        LockChain<BtcTransaction, BtcDeposit, BtcAddress, BtcNetwork, boolean> {
    getBurnPayload: (() => string) | undefined;

    /**
     * When burning, you can call `Bitcoin.Address("...")` to make the address
     * available to the burn params.
     *
     * @category Main
     */
    Address = (address: string): this => {
        // Type validation
        assertType<string>("string", { address });

        this.getBurnPayload = () => address;
        return this;
    };

    burnPayload? = () => {
        return this.getBurnPayload ? this.getBurnPayload() : undefined;
    };

    toSats = (value: BigNumber | string | number): string =>
        new BigNumber(value)
            .times(new BigNumber(10).exponentiatedBy(8))
            .toFixed();

    fromSats = (value: BigNumber | string | number): string =>
        new BigNumber(value)
            .dividedBy(new BigNumber(10).exponentiatedBy(8))
            .toFixed();
}

// @dev Removes any static fields.
export type Bitcoin = BitcoinClass;
export const Bitcoin = Callable(BitcoinClass);

const _: MintChainStatic<BtcTransaction, BtcAddress, BtcNetwork> = Bitcoin;
