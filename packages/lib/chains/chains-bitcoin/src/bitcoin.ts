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

export class BitcoinChain
    extends BitcoinBaseChain
    implements LockChain<Transaction, Deposit, Asset, Address> {
    getBurnPayload: (() => string) | undefined;

    constructor(
        network?: BitcoinNetwork,
        thisClass: typeof BitcoinBaseChain = BitcoinChain
    ) {
        super(network, thisClass);
    }

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
export const Bitcoin = Callable(BitcoinChain);
