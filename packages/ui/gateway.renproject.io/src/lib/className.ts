export const classNames = (...args: Array<string | undefined>): string => {
    return args.join(" ") || "";
};
