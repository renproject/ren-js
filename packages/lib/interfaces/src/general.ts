export type BN = {
    toString: () => string;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    isBN: (b: any) => boolean;
};
