// tslint:disable-next-line: ban-types no-any
export const setIntervalAndRun = (handler: Function, timeout?: number | undefined, ...args: any[]): number => {
    handler(...args);
    return setInterval(handler, timeout, ...args);
};
