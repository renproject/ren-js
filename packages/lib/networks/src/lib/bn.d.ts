/*
 * These types are based on [1] from @ukstv and [2] from @MicahZoltu.
 * If anything is wrong with these types, feel free to complain to @vsund.
 *
 * [1] https://github.com/machinomy/types-bn
 * [2] https://github.com/indutny/bn.js/pull/179
 */

declare module "bn.js" {

    export type Endianness = "le" | "be";

    // Fix web3 types expecting BigNumber export
    export type BigNumber = BN;

    export class BN {
        public static isBN(b: any): b is BN;
        public static min(left: BN, right: BN): BN;
        public static max(left: BN, right: BN): BN;

        constructor(input: number | string | number[] | Buffer, base?: number | "hex", endian?: Endianness);

        public clone(): BN;
        public copy(dest: BN): void;
        public inspect(): string;
        public toString(base?: number | "hex", length?: number): string;
        public toNumber(): number;
        public toJSON(): string;
        public toArray(endian?: Endianness, length?: number): number[];
        public toArrayLike<B>(arrayLike: { new(params: any): B }, endian?: Endianness, length?: number): B;
        public toBuffer(endian?: Endianness, length?: number): Buffer;
        public bitLength(): number;
        public zeroBits(): number;
        public byteLength(): number;
        public isNeg(): boolean;
        public isEven(): boolean;
        public isOdd(): boolean;
        public isZero(): boolean;
        public cmp(b: BN): number;
        public lt(b: BN): boolean;
        public lte(b: BN): boolean;
        public gt(b: BN): boolean;
        public gte(b: BN): boolean;
        public eq(b: BN): boolean;

        public neg(): BN;
        public abs(): BN;
        public add(b: BN): BN;
        public sub(b: BN): BN;
        public mul(b: BN): BN;
        public sqr(): BN;
        public pow(b: BN): BN;
        public div(b: BN): BN;
        public mod(b: BN): BN;
        public divRound(b: BN): BN;

        public or(b: BN): BN;
        public and(b: BN): BN;
        public xor(b: BN): BN;
        public setn(b: number): BN;
        public shln(b: number): BN;
        public shrn(b: number): BN;
        public testn(b: number): boolean;
        public maskn(b: number): BN;
        public bincn(b: number): BN;
        public notn(w: number): BN;

        public gcd(b: BN): BN;
        public egcd(b: BN): { a: BN; b: BN; gcd: BN };
        public invm(b: BN): BN;
    }

}