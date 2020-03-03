import { Asset, Chain, RenContract, Tokens as CommonTokens } from "@renproject/ren-js-common";

import { bchAddressFrom, bchAddressToHex, getBitcoinCashUTXOs } from "../blockchain/bch";
import { btcAddressFrom, btcAddressToHex, getBitcoinUTXOs } from "../blockchain/btc";
import { getZcashUTXOs, zecAddressFrom, zecAddressToHex } from "../blockchain/zec";

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
        ...CommonTokens.BTC,
        ...btcUtils,
    },

    // Zcash
    ZEC: {
        ...CommonTokens.ZEC,
        ...zecUtils,
    },

    // Bitcoin Cash
    BCH: {
        ...CommonTokens.BCH,
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
