
enum RenNetwork {
    Testnet = "testnet",
    Devnet = "devnet",
}

export const NETWORK = RenNetwork.Testnet;

export const lightnodeURLs = {
    [RenNetwork.Testnet]: "https://lightnode-testnet.herokuapp.com",
    [RenNetwork.Devnet]: "https://lightnode-devnet.herokuapp.com",
};

export const masterKeys = {
    [RenNetwork.Testnet]: {
        mpkh: "feea966136a436e44c96335455771943452728fc",
        eth: "44Bb4eF43408072bC888Afd1a5986ba0Ce35Cb54",
    },
    [RenNetwork.Devnet]: {
        mpkh: "390e916c0f9022ef6cc44f05cd5094b2d9597574",
        eth: "723eb4380e03df6a6f98cc1338b00cfbe5e45218",
    }
};

export const zBTC = {
    [RenNetwork.Testnet]: "0x7cf9A2de7D5e81e6d4372D9b20D27AB8267295d5",
    [RenNetwork.Devnet]: "0xef44c39102Ab3479F271e2fb3F27dB56D13b7a42",
};
