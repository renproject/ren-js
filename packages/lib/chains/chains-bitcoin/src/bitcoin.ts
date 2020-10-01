import { LockChain } from "@renproject/interfaces";
import { assertType, Callable } from "@renproject/utils";

import {
    Address,
    Asset,
    BitcoinBaseChain,
    BitcoinNetwork,
    Deposit,
    Transaction,
} from "./base";

export class BitcoinClass
    extends BitcoinBaseChain
    implements LockChain<Transaction, Deposit, Asset, Address> {
    getBurnPayload: (() => string) | undefined;

    Address = (address: string): this => {
        // Type validation
        assertType("string", { address });

        this.getBurnPayload = () => address;
        return this;
    };

    burnPayload? = () => {
        return this.getBurnPayload ? this.getBurnPayload() : undefined;
    };
}

// @dev Removes any static fields.
export type Bitcoin = BitcoinClass;
export const Bitcoin = Callable(BitcoinClass);
