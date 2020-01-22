export enum Network {
    Mainnet = "mainnet",
    Chaosnet = "chaosnet",
    Testnet = "testnet",
    Devnet = "devnet",
    Localnet = "localnet",
}

export enum Chain {
    Bitcoin = "Btc",
    Ethereum = "Eth",
    Zcash = "Zec",
    BitcoinCash = "Bch",
}

export enum Asset {
    BTC = "BTC",
    ZEC = "ZEC",
    ETH = "ETH",
    BCH = "BCH",
}

export enum RenContract {
    Btc2Eth = "BTC0Btc2Eth",
    Eth2Btc = "BTC0Eth2Btc",
    Zec2Eth = "ZEC0Zec2Eth",
    Eth2Zec = "ZEC0Eth2Zec",
    Bch2Eth = "BCH0Bch2Eth",
    Eth2Bch = "BCH0Eth2Bch",
}

export const Tokens = {
    // Bitcoin
    BTC: {
        Mint: RenContract.Btc2Eth,
        Btc2Eth: RenContract.Btc2Eth,

        Burn: RenContract.Eth2Btc,
        Eth2Btc: RenContract.Eth2Btc,
    },

    // Zcash
    ZEC: {
        Mint: RenContract.Zec2Eth,
        Zec2Eth: RenContract.Zec2Eth,

        Burn: RenContract.Eth2Zec,
        Eth2Zec: RenContract.Eth2Zec,
    },

    // Bitcoin Cash
    BCH: {
        Mint: RenContract.Bch2Eth,
        Bch2Eth: RenContract.Bch2Eth,

        Burn: RenContract.Eth2Bch,
        Eth2Bch: RenContract.Eth2Bch,
    },
};
