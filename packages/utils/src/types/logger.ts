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
    log(message?: unknown, ...optionalParams: unknown[]): void;
    debug(message?: unknown, ...optionalParams: unknown[]): void;
    trace(message?: unknown, ...optionalParams: unknown[]): void;

    // Return the logging level, as a number from 0 (trace) to 5 (silent).
    getLevel?(): LogLevel | number;
}

const doNothing = (): void => {};

/**
 * nullLogger is a helper utility to avoid having to check whether a logger is
 * defined.
 *
 * @example
 * ```
 * const logger = params.logger || nullLogger;
 * logger.debug("Test.");
 * ```
 */
export const nullLogger: Logger = {
    trace: doNothing,
    debug: doNothing,
    log: doNothing,
    info: doNothing,
    warn: doNothing,
    error: doNothing,
};
