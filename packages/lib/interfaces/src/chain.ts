
export interface OriginChain<Deposit> {
    name: string;
    network: string | undefined;

    // Supported assets
    supportsAsset: (asset: string) => (Promise<boolean> | boolean);
    assetDecimals: (asset: string) => (Promise<number> | number);

    initialize: (network: string) => (Promise<void> | void);

    getDeposits: ({ isTestnet }: { isTestnet: boolean }) => (address: string, confirmations: number) => (Promise<readonly Deposit[]> | readonly Deposit[]);

    addressToHex: (address: string) => string;

    addressFrom: (address: string) => string;

    getConfirmations: ({ isTestnet }: {
        isTestnet: boolean;
    }) => (txHash: string) => (Promise<number> | number);

    createAddress: (isTestnet: boolean, mpkh: string, gHash: string) => (Promise<string> | string);
}

export interface HostChain {
    name: string;

    supportsAsset: (asset: string) => (Promise<boolean> | boolean);
}
