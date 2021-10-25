/* eslint-disable no-console */

import BigNumber from "bignumber.js";

export enum LogLevel {
    Error = 0,
    Warn = 1,
    Log = 2,
    Info = 3,
    Debug = 4,
    Trace = 5,
}

export interface Logger {
    level?: unknown;
    error(message?: unknown, ...optionalParams: unknown[]): void;
    warn(message?: unknown, ...optionalParams: unknown[]): void;
    log(message?: unknown, ...optionalParams: unknown[]): void;
    info(message?: unknown, ...optionalParams: unknown[]): void;
    debug(message?: unknown, ...optionalParams: unknown[]): void;
    trace(message?: unknown, ...optionalParams: unknown[]): void;
}

export type LogLevelString =
    | "error"
    | "warn"
    | "log"
    | "info"
    | "debug"
    | "trace"
    | LogLevel;

const stringToLogLevel = (level: LogLevelString): LogLevel => {
    switch (level) {
        case "error":
        case LogLevel.Error:
            return 0;
        case "warn":
        case LogLevel.Warn:
            return 1;
        case "warn":
        case LogLevel.Log:
            return 2;
        case "info":
        case LogLevel.Info:
            return 3;
        case "debug":
        case LogLevel.Debug:
            return 4;
        case "trace":
        case LogLevel.Trace:
            return 5;
        default:
            return 1;
    }
};

const logLevelName = (level: LogLevelString): string => {
    switch (stringToLogLevel(level)) {
        case LogLevel.Error:
            return "ERROR";
        case LogLevel.Warn:
            return "WARN";
        case LogLevel.Log:
            return "WARN";
        case LogLevel.Info:
            return "INFO";
        case LogLevel.Debug:
            return "DEBUG";
        case LogLevel.Trace:
            return "TRACE";
    }
};

const toString = (value: unknown): unknown => {
    try {
        if (BigNumber.isBigNumber(value)) {
            return value.toFixed();
        }
        return value;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
        try {
            return String(value);
        } catch (errorInner) {
            return "";
        }
    }
};

type Prefix = (level: LogLevelString) => string | undefined;

const printWithPrefix = (
    l: typeof console.log,
    prefix: string | undefined,
    ...args: unknown[]
) => {
    if (prefix) {
        l(prefix, ...args);
    } else {
        l(...args);
    }
};

/**
 * SimpleLogger is a implementation of the Logger interface that also supports
 * setting the log level.
 *
 * @export
 * @class SimpleLogger
 */
export class SimpleLogger {
    public level: LogLevel;

    public logPrefix: Prefix = () => "";
    public debugPrefix: Prefix = (level: LogLevelString) =>
        `[RenJS][${logLevelName(level)}]`;

    constructor(
        level: LogLevelString = LogLevel.Warn,
        logPrefix?: Prefix | string,
        debugPrefix?: Prefix | string,
    ) {
        this.level = level as LogLevel;
        if (logPrefix) {
            const logPrefixFn =
                typeof logPrefix === "string" ? () => logPrefix : logPrefix;
            this.logPrefix = logPrefixFn;
            this.debugPrefix = logPrefixFn;
        }
        if (debugPrefix) {
            const debugPrefixFn =
                typeof debugPrefix === "string"
                    ? () => debugPrefix
                    : debugPrefix;
            this.debugPrefix = debugPrefixFn;
        }
    }

    public trace = (message?: unknown, ...optionalParams: unknown[]): void => {
        if (this.level >= LogLevel.Trace) {
            if (optionalParams.length && typeof message === "string") {
                console.group(
                    (this.debugPrefix(LogLevel.Trace) || "") + message,
                );
                console.trace(...optionalParams.map(toString));
                console.groupEnd();
            } else {
                printWithPrefix(
                    console.trace,
                    this.debugPrefix(LogLevel.Trace),
                    toString(message),
                    ...optionalParams.map(toString),
                );
            }
        }
    };

    public debug = (message?: unknown, ...optionalParams: unknown[]): void => {
        if (this.level >= LogLevel.Debug) {
            if (optionalParams.length && typeof message === "string") {
                console.group(
                    (this.debugPrefix(LogLevel.Debug) || "") + message,
                );
                console.debug(...optionalParams.map(toString));
                console.groupEnd();
            } else {
                printWithPrefix(
                    console.debug,
                    this.debugPrefix(LogLevel.Debug),
                    toString(message),
                    ...optionalParams.map(toString),
                );
            }
        }
    };

    public info = (...optionalParams: unknown[]): void => {
        if (this.level >= LogLevel.Info) {
            printWithPrefix(
                console.info,
                this.logPrefix(LogLevel.Info),
                ...optionalParams.map(toString),
            );
        }
    };

    public log = (...optionalParams: unknown[]): void => {
        if (this.level >= LogLevel.Log) {
            printWithPrefix(
                console.log,
                this.logPrefix(LogLevel.Log),
                ...optionalParams.map(toString),
            );
        }
    };

    public warn = (...optionalParams: unknown[]): void => {
        if (this.level >= LogLevel.Warn) {
            printWithPrefix(
                console.warn,
                this.logPrefix(LogLevel.Warn),
                ...optionalParams.map(toString),
            );
        }
    };

    public error = (...optionalParams: unknown[]): void => {
        if (this.level >= LogLevel.Error) {
            printWithPrefix(
                console.error,
                this.logPrefix(LogLevel.Error),
                ...optionalParams.map(toString),
            );
        }
    };
}

export const NullLogger: Logger = {
    level: -1,
    trace: (_message?: unknown, ..._optionalParams: unknown[]): void => {},
    debug: (_message?: unknown, ..._optionalParams: unknown[]): void => {},
    info: (_message?: unknown, ..._optionalParams: unknown[]): void => {},
    log: (_message?: unknown, ..._optionalParams: unknown[]): void => {},
    warn: (_message?: unknown, ..._optionalParams: unknown[]): void => {},
    error: (_message?: unknown, ..._optionalParams: unknown[]): void => {},
};
