import { Logger, LogLevelString } from "@renproject/interfaces";

export interface RenJSConfig {
    /**
     * The logger and logLevel are used to configure where RenJS sends debug
     * and error logs. Set the logLevel to `LogLevel.Debug` or `LogLevel.Trace`
     * to receive debug logs.
     */
    logLevel?: LogLevelString;
    logger?: Logger;

    /**
     * `networkDelay` is the timeout in ms between retrying various network
     * requests including 1) fetching deposits, 2) fetching confirmations and
     * 3) fetching a transaction's RenVM status.
     *
     * It defaults to `15000` (15 seconds).
     */
    networkDelay?: number;

    /**
     * `loadCompletedDeposits` whether or not to detect deposits that have
     * already been minted.
     *
     * It defaults to false
     */
    loadCompletedDeposits?: boolean;

    /**
     * Allow overriding the gPubKey.
     */
    gPubKey?: Buffer;
}
