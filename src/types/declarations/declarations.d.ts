declare module "wallet-address-validator";
declare module "bs58" {
    export const encode: (source: Buffer) => string;
    export const decodeUnsafe: (source: string) => Buffer | undefined;
    export const decode: (string: string) => Buffer;
}