import { LockChain } from "@renproject/interfaces";
import { assertType, Callable } from "@renproject/utils";

import { Address, Asset, BitcoinBaseChain, Deposit, Transaction } from "./base";

export class BitcoinClass extends BitcoinBaseChain
    implements LockChain<Transaction, Deposit, Asset, Address> {
    getBurnPayload: (() => string) | undefined;

    addressExplorerLink = (address: Address): string | undefined => {
        if (this.chainNetwork === "mainnet") {
            return `https://live.blockcypher.com/btc/address/${address}/`;
        } else if (this.chainNetwork === "testnet") {
            return `https://live.blockcypher.com/btc-testnet/address/${address}/`;
        }
        return undefined;
    };

    transactionExplorerLink = (tx: Transaction): string | undefined => {
        if (this.chainNetwork === "mainnet") {
            return `https://live.blockcypher.com/btc/tx/${tx.txHash}/`;
        } else if (this.chainNetwork === "testnet") {
            return `https://live.blockcypher.com/btc-testnet/tx/${tx.txHash}/`;
        }
        return undefined;
    };

    Address = (address: string): this => {
        // Type validation
        assertType<string>("string", { address });

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
