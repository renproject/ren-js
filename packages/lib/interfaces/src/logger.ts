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
export type LogLevelString = "error" | "warn" | "log" | "info" | "debug" | "trace" | LogLevel;

const levelValue = (level: LogLevel) => {
    switch (level) {
        case LogLevel.Error: return 0;
        case LogLevel.Warn: return 1;
        case LogLevel.Log: return 2;
        case LogLevel.Info: return 3;
        case LogLevel.Debug: return 4;
        case LogLevel.Trace: return 5;
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
        return JSON.stringify(value, (_key, val) => {
            if (val !== null && typeof val === "object") {
                if (seen.indexOf(val) >= 0) {
                    return;
                }
                seen.push(val);
            }
            return val;
        }, "    ");
    } catch (error) {
        try {
            return String(value);
        } catch (error) {
            return "";
        }
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

    constructor(level: LogLevelString = LogLevel.Warn) {
        this.level = level as LogLevel;
    }

    public trace = (message?: any, ...optionalParams: any[]): void => {
        if (levelValue(this.level) >= levelValue(LogLevel.Trace)) {
            if (optionalParams.length) {
                console.group(this.prefix(LogLevel.Trace) + toString(message));
                console.trace(...optionalParams.map(toString));
                console.groupEnd();
            } else {
                console.trace(this.prefix(LogLevel.Trace) + toString(message), ...optionalParams.map(toString));
            }
        }
    }

    public debug = (message?: any, ...optionalParams: any[]): void => {
        if (levelValue(this.level) >= levelValue(LogLevel.Debug)) {
            if (optionalParams.length) {
                console.group(this.prefix(LogLevel.Debug) + toString(message));
                console.debug(...optionalParams.map(toString));
                console.groupEnd();
            } else {
                console.debug(this.prefix(LogLevel.Debug) + toString(message), ...optionalParams.map(toString));
            }
        }
    }

    public info = (message?: any, ...optionalParams: any[]): void => {
        if (levelValue(this.level) >= levelValue(LogLevel.Info)) { console.info(toString(message), ...optionalParams.map(toString)); }
    }

    public log = (message?: any, ...optionalParams: any[]): void => {
        if (levelValue(this.level) >= levelValue(LogLevel.Log)) { console.log(toString(message), ...optionalParams.map(toString)); }
    }

    public warn = (message?: any, ...optionalParams: any[]): void => {
        if (levelValue(this.level) >= levelValue(LogLevel.Warn)) { console.warn(toString(message), ...optionalParams.map(toString)); }
    }

    public error = (message?: any, ...optionalParams: any[]): void => {
        if (levelValue(this.level) >= levelValue(LogLevel.Error)) { console.error(toString(message), ...optionalParams.map(toString)); }
    }

    private readonly prefix = (level: LogLevel) => `[RenJS][${level.toUpperCase()}] `;
}
