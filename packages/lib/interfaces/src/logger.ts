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

const toString = (value: unknown): string => {
    try {
        if (typeof value === "string") {
            return value;
        }
        if (BigNumber.isBigNumber(value)) {
            return value.toFixed();
        }
        const seen: unknown[] = [];
        return JSON.stringify(
            value,
            (_key, val: unknown) => {
                if (val !== null && typeof val === "object") {
                    if (seen.indexOf(val) >= 0) {
                        return;
                    }
                    seen.push(val);
                }
                return val;
            },
            "    ",
        );
    } catch (error) {
        try {
            return String(value);
        } catch (errorInner) {
            return "";
        }
    }
};

type Prefix = (level: LogLevelString) => string;

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
        `[RenJS][${logLevelName(level)}] `;

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
            if (optionalParams.length) {
                console.group(
                    this.debugPrefix(LogLevel.Trace) + toString(message),
                );
                console.trace(...optionalParams.map(toString));
                console.groupEnd();
            } else {
                console.trace(
                    this.debugPrefix(LogLevel.Trace) + toString(message),
                    ...optionalParams.map(toString),
                );
            }
        }
    };

    public debug = (message?: unknown, ...optionalParams: unknown[]): void => {
        if (this.level >= LogLevel.Debug) {
            if (optionalParams.length) {
                console.group(
                    this.debugPrefix(LogLevel.Debug) + toString(message),
                );
                console.debug(...optionalParams.map(toString));
                console.groupEnd();
            } else {
                console.debug(
                    this.debugPrefix(LogLevel.Debug) + toString(message),
                    ...optionalParams.map(toString),
                );
            }
        }
    };

    public info = (message?: unknown, ...optionalParams: unknown[]): void => {
        if (this.level >= LogLevel.Info) {
            console.info(
                this.logPrefix(LogLevel.Debug) + toString(message),
                ...optionalParams.map(toString),
            );
        }
    };

    public log = (message?: unknown, ...optionalParams: unknown[]): void => {
        if (this.level >= LogLevel.Log) {
            console.log(
                this.logPrefix(LogLevel.Debug) + toString(message),
                ...optionalParams.map(toString),
            );
        }
    };

    public warn = (message?: unknown, ...optionalParams: unknown[]): void => {
        if (this.level >= LogLevel.Warn) {
            console.warn(
                this.logPrefix(LogLevel.Debug) + toString(message),
                ...optionalParams.map(toString),
            );
        }
    };

    public error = (message?: unknown, ...optionalParams: unknown[]): void => {
        if (this.level >= LogLevel.Error) {
            console.error(
                this.logPrefix(LogLevel.Debug) + toString(message),
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
