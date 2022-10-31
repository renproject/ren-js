import { defaultLogger, Logger, LogLevel, utils } from "@renproject/utils";

export { LogLevel } from "@renproject/utils";

export interface RenJSConfig {
    /**
     * The logger and logLevel are used to configure where RenJS sends debug
     * and error logs. Set the logLevel to `LogLevel.Debug` or `LogLevel.Trace`
     * to receive debug logs.
     */
    logLevel?: LogLevel;
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
    // loadCompletedDeposits?: boolean;
}

export const defaultRenJSConfig = {
    logLevel: LogLevel.Debug,
    logger: defaultLogger,
    networkDelay: 15 * utils.sleep.SECONDS,
    // loadCompletedDeposits: false as boolean,
};

// Check that defaultRenJSConfig is a valid RenJSConfig object, while
// still allowing typescript to infer its type from is value, so that it knows
// that `defaultRenJSConfig.logger` is not potentially undefined.
const _check: RenJSConfig = defaultRenJSConfig;
