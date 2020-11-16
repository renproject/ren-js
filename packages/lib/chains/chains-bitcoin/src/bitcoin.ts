import { LockChain } from "@renproject/interfaces";
import { assertType, Callable } from "@renproject/utils";
import BigNumber from "bignumber.js";

import { Address, BitcoinBaseChain, Deposit, Transaction } from "./base";

/**
 * The Bitcoin class adds support for the asset BTC.
 */
export class BitcoinClass extends BitcoinBaseChain
    implements LockChain<Transaction, Deposit, Address> {
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
