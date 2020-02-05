export const validateString = <T extends string>(shouldBeString: unknown, errorMessage: string, options?: readonly T[]): shouldBeString is T => {
    if (typeof shouldBeString !== "string") { throw new Error(errorMessage); }
    if (options && options.indexOf(shouldBeString as T) === -1) { throw new Error(errorMessage); }
    return true;
};
