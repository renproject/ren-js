export type BN = {
    toString: () => string;

    // tslint:disable-next-line: no-any
    isBN: (b: any) => boolean;
};
