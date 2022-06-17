/** Based on log levels from the `loglevel` npm package. */
export enum LogLevel {
    Trace = 0,
    Debug = 1,
    Log = LogLevel.Debug,
    Info = 2,
    Warn = 3,
    Error = 4,
    Silent = 5,
}

/**
 * Standard logger/console interface.
 */
export interface Logger {
    error(message?: unknown, ...optionalParams: unknown[]): void;
    warn(message?: unknown, ...optionalParams: unknown[]): void;
    info(message?: unknown, ...optionalParams: unknown[]): void;
    debug(message?: unknown, ...optionalParams: unknown[]): void;

    // Return the logging level, as a number from 0 (trace) to 5 (silent).
    getLevel?(): LogLevel | number;
}

const doNothing = (): void => {};

/**
 * The defaultLogger forwards info, warn and error logs to the console, and
 * ignores debug logs.
 *
 * @example
 * ```
 * const logger = params.logger || defaultLogger;
 * logger.debug("Test.");
 * ```
 */
export const defaultLogger: Logger = {
    debug: doNothing,
    // eslint-disable-next-line no-console
    info: console.info,
    warn: console.warn,
    error: console.error,
};
