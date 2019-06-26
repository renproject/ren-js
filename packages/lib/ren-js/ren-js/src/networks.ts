export interface Network {
    name: string;
    lightnodeURL: string;
    masterKey: {
        mpkh: string;
        eth: string;
    };
    zBTC: string; // TODO: Use map of tokens
    BTCShifter: string;
}

export const NetworkMainnet: Network = {
    name: "mainnet",
    lightnodeURL: "",
    masterKey: {
        mpkh: "",
        eth: "",
    },
    zBTC: "",
    BTCShifter: "",
};

export const NetworkTestnet: Network = {
    name: "testnet",
    lightnodeURL: "https://lightnode-testnet.herokuapp.com",
    masterKey: {
        mpkh: "feea966136a436e44c96335455771943452728fc",
        eth: "44Bb4eF43408072bC888Afd1a5986ba0Ce35Cb54",
    },
    zBTC: "0x1aFf7F90Bab456637a17d666D647Ea441A189F2d",
    BTCShifter: "0x8a0E8dfC2389726DF1c0bAB874dd2C9A6031b28f",
};

export const NetworkDevnet: Network = {
    name: "devnet",
    lightnodeURL: "https://lightnode-devnet.herokuapp.com",
    masterKey: {
        mpkh: "390e916c0f9022ef6cc44f05cd5094b2d9597574",
        eth: "723eb4380e03df6a6f98cc1338b00cfbe5e45218",
    },
    zBTC: "0x4eB1403f565c3e3145Afc3634F16e2F092545C2a",
    BTCShifter: "0x7a40fE9FB464510215C41Eae1216973514eeEBB1",
};
