import { EventEmitter } from "events";

import { EventEmitterTyped } from "@renproject/utils";

import { GatewayTransaction } from "../gatewayTransaction";

// The TransactionEmitter extends the built-in EventEmitter, adding the ability
// to retrieve previous transactions that have been emitted.
export class TransactionEmitter<
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ToPayload extends { chain: string; txConfig?: any } = any,
    >
    extends EventEmitter
    implements
        EventEmitterTyped<{ transaction: [GatewayTransaction<ToPayload>] }>
{
    private getTransactions: () => Array<GatewayTransaction<ToPayload>>;

    public constructor(
        getTransactions: () => Array<GatewayTransaction<ToPayload>>,
    ) {
        super();

        this.getTransactions = getTransactions;
    }

    public addListener = <Event extends "transaction">(
        event: Event,
        callback: Event extends "transaction"
            ? // eslint-disable-next-line @typescript-eslint/no-explicit-any
              (deposit: GatewayTransaction<ToPayload>) => void
            : never,
    ): this => {
        // Emit previous deposit events.
        if (event === "transaction") {
            this.getTransactions().map(callback);
        }

        super.on(event, callback);
        return this;
    };

    /**
     * `on` creates a new listener to `"transaction"` events, returning
     * [[GatewayTransaction]] instances.
     *
     * `on` extends `EventEmitter.on`, modifying it to immediately return all
     * previous `"transaction"` events, in addition to new events, when a new
     * listener is created.
     *
     * @category Main
     */
    // @ts-expect-error EventEmitter and EventEmitterTyped typing issue
    public on = <Event extends "transaction">(
        event: Event,
        callback: Event extends "transaction"
            ? (deposit: GatewayTransaction<ToPayload>) => void
            : never,
    ): this => this.addListener(event, callback);
}
