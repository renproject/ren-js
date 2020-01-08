import { bchAddressFrom, bchAddressToHex, getBitcoinCashUTXOs } from "../blockchain/bch";
import { btcAddressFrom, btcAddressToHex, getBitcoinUTXOs } from "../blockchain/btc";
import { getZcashUTXOs, zecAddressFrom, zecAddressToHex } from "../blockchain/zec";

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

export const btcUtils = {
    getUTXOs: getBitcoinUTXOs,
    addressToHex: btcAddressToHex,
    addressFrom: btcAddressFrom,
};

export const zecUtils = {
    getUTXOs: getZcashUTXOs,
    addressToHex: zecAddressToHex,
    addressFrom: zecAddressFrom,
};

export const bchUtils = {
    getUTXOs: getBitcoinCashUTXOs,
    addressToHex: bchAddressToHex,
    addressFrom: bchAddressFrom,
};

export const Tokens = {
    // Bitcoin
    BTC: {
        Mint: RenContract.Btc2Eth,
        Btc2Eth: RenContract.Btc2Eth,

        Burn: RenContract.Eth2Btc,
        Eth2Btc: RenContract.Eth2Btc,

        ...btcUtils,
    },

    // Zcash
    ZEC: {
        Mint: RenContract.Zec2Eth,
        Zec2Eth: RenContract.Zec2Eth,

        Burn: RenContract.Eth2Zec,
        Eth2Zec: RenContract.Eth2Zec,

        ...zecUtils,
    },

    // Bitcoin Cash
    BCH: {
        Mint: RenContract.Bch2Eth,
        Bch2Eth: RenContract.Bch2Eth,

        Burn: RenContract.Eth2Bch,
        Eth2Bch: RenContract.Eth2Bch,

        ...bchUtils
    },
};

interface RenContractDetails {
    asset: Asset;
    from: Chain;
    to: Chain;
}

const renContractRegex = /^(.*)0(.*)2(.*)$/;
const defaultMatch = [undefined, undefined, undefined, undefined];

// parseRenContract splits an action (e.g. `BTC0Eth2Btc`) into the asset
// (`BTC`), the from chain (`Eth`)
export const parseRenContract = (renContract: RenContract): RenContractDetails => {
    // re.exec("BTC0Eth2Btc") => ['BTC0Eth2Btc', 'BTC', 'Eth', 'Btc']
    const [, asset, from, to] = renContractRegex.exec(renContract) || defaultMatch;
    if (!asset || !from || !to) {
        throw new Error(`Invalid Ren Contract "${renContract}"`);
    }

    return {
        asset: asset as Asset,
        from: from as Chain,
        to: to as Chain
    };
};
