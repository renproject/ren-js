
// tslint:disable-next-line: no-any
export const isPromise = <T>(p: any): p is Promise<T> => {
    return p.hasOwnProperty("then");
};

// tslint:disable-next-line: no-any ban-types
export const isFunction = (p: any): p is Function => {
    return typeof p === "function";
};
