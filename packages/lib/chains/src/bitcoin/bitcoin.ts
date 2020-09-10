import { LockChain } from "@renproject/interfaces";
import { assertType } from "@renproject/utils";

import { Callable } from "../class";
import {
    Address,
    Asset,
    BitcoinBaseChain,
    BitcoinNetwork,
    Transaction,
} from "./base";

export class BitcoinChain
    extends BitcoinBaseChain
    implements LockChain<Transaction, Asset, Address> {
    getBurnPayload: (() => string) | undefined;

    constructor(network?: BitcoinNetwork) {
        super(network, BitcoinChain);
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

export const Bitcoin = Callable(BitcoinChain);
