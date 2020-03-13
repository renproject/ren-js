import {
    bchAddressFrom, bchAddressToHex, btcAddressFrom, btcAddressToHex, getBitcoinCashUTXOs,
    getBitcoinUTXOs, getZcashUTXOs, zecAddressFrom, zecAddressToHex,
} from "@renproject/chains";
import { Tokens as CommonTokens } from "@renproject/interfaces";

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
