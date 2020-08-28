import { BNInterface } from "@renproject/interfaces";

// Copied over from @renproject/utils to avoid a circular dependency.
export const strip0x = (hex: string) => {
    // tslint:disable-next-line: strict-type-predicates
    if (typeof hex !== "string") {
        throw new Error(`Expected string to be passed in to 'strip0x'`);
    }
    return hex.substring(0, 2) === "0x" ? hex.slice(2) : hex;
};

export const Ox = (hex: string | Buffer | BNInterface) => {
    const hexString = typeof hex === "string" ? hex : hex.toString("hex");
    return hexString.substring(0, 2) === "0x" ? hexString : `0x${hexString}`;
};
