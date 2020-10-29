// tslint:disable: no-any no-console

import BigNumber from "bignumber.js";

export interface Logger {
    error(message?: any, ...optionalParams: any[]): void;
    warn(message?: any, ...optionalParams: any[]): void;
    log(message?: any, ...optionalParams: any[]): void;
    info(message?: any, ...optionalParams: any[]): void;
    debug(message?: any, ...optionalParams: any[]): void;
    trace(message?: any, ...optionalParams: any[]): void;
}

export enum LogLevel {
    Error = "error",
    Warn = "warn",
    Log = "log",
    Info = "info",
    Debug = "debug",
    Trace = "trace",
}
export type LogLevelString =
    | "error"
    | "warn"
    | "log"
    | "info"
    | "debug"
    | "trace"
    | LogLevel;

const levelValue = (level: LogLevel) => {
    switch (level) {
        case LogLevel.Error:
            return 0;
        case LogLevel.Warn:
            return 1;
        case LogLevel.Log:
            return 2;
        case LogLevel.Info:
            return 3;
        case LogLevel.Debug:
            return 4;
        case LogLevel.Trace:
            return 5;
    }
};

const toString = (value: any) => {
    try {
        if (typeof value === "string") {
            return value;
        }
        if (BigNumber.isBigNumber(value)) {
            return value.toFixed();
        }
        const seen: any[] = [];
        return JSON.stringify(
            value,
            (_key, val) => {
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
        } catch (error) {
            return "";
        }
    }
};

type Prefix = (level: LogLevel) => string;

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
    public debugPrefix: Prefix = (level: LogLevel) =>
        `[RenJS][${level.toUpperCase()}] `;

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

    public trace = (message?: any, ...optionalParams: any[]): void => {
        if (levelValue(this.level) >= levelValue(LogLevel.Trace)) {
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

    public debug = (message?: any, ...optionalParams: any[]): void => {
        if (levelValue(this.level) >= levelValue(LogLevel.Debug)) {
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

    public info = (message?: any, ...optionalParams: any[]): void => {
        if (levelValue(this.level) >= levelValue(LogLevel.Info)) {
            console.info(
                this.logPrefix(LogLevel.Debug) + toString(message),
                ...optionalParams.map(toString),
            );
        }
    };

    public log = (message?: any, ...optionalParams: any[]): void => {
        if (levelValue(this.level) >= levelValue(LogLevel.Log)) {
            console.log(
                this.logPrefix(LogLevel.Debug) + toString(message),
                ...optionalParams.map(toString),
            );
        }
    };

    public warn = (message?: any, ...optionalParams: any[]): void => {
        if (levelValue(this.level) >= levelValue(LogLevel.Warn)) {
            console.warn(
                this.logPrefix(LogLevel.Debug) + toString(message),
                ...optionalParams.map(toString),
            );
        }
    };

    public error = (message?: any, ...optionalParams: any[]): void => {
        if (levelValue(this.level) >= levelValue(LogLevel.Error)) {
            console.error(
                this.logPrefix(LogLevel.Debug) + toString(message),
                ...optionalParams.map(toString),
            );
        }
    };
}
