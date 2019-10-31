import { bchAddressToHex } from "../blockchain/bch";
import { btcAddressToHex } from "../blockchain/btc";
import { zecAddressToHex } from "../blockchain/zec";

export enum Chain {
    Bitcoin = "Btc",
    Ethereum = "Eth",
    Zcash = "Zec",
    BCash = "Bch",
}

export enum Asset {
    BTC = "BTC",
    ZEC = "ZEC",
    ETH = "ETH",
    BCH = "BCH",
}

export enum Token {
    Btc2Eth = "BTC0Btc2Eth",
    Eth2Btc = "BTC0Eth2Btc",
    Zec2Eth = "ZEC0Zec2Eth",
    Eth2Zec = "ZEC0Eth2Zec",
    Bch2Eth = "BCH0Bch2Eth",
    Eth2Bch = "BCH0Eth2Bch",
}

export const Tokens = {
    BTC: {
        Btc2Eth: Token.Btc2Eth,
        Eth2Btc: Token.Eth2Btc,
        addressToHex: btcAddressToHex,
    },
    ZEC: {
        Zec2Eth: Token.Zec2Eth,
        Eth2Zec: Token.Eth2Zec,
        addressToHex: zecAddressToHex,
    },
    BCH: {
        Bch2Eth: Token.Bch2Eth,
        Eth2Bch: Token.Eth2Bch,
        addressToHex: bchAddressToHex,
    },
};

export interface ActionDetails {
    asset: Asset;
    from: Chain;
    to: Chain;
}

const shiftActionRegex = /^(.*)0(.*)2(.*)$/;
const defaultMatch = [undefined, undefined, undefined, undefined];

// actionToDetails splits an action (e.g. `BTC0Eth2Btc`) into the asset
// (`BTC`), the from chain (`Eth`)
export const actionToDetails = (shiftAction: Token): ActionDetails => {
    // re.exec("BTC0Eth2Btc") => ['BTC0Eth2Btc', 'BTC', 'Eth', 'Btc']
    const [, asset, from, to] = shiftActionRegex.exec(shiftAction) || defaultMatch;
    if (!asset || !from || !to) {
        throw new Error(`Invalid shift action "${shiftAction}"`);
    }

    return {
        asset: asset as Asset,
        from: from as Chain,
        to: to as Chain
    };
};
