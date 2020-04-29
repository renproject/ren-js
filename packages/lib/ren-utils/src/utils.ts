import { bchUtils, btcUtils, zecUtils } from "./chains";
import { Ox, strip0x } from "./common";
import { randomNonce } from "./renVMUtils";
import { value } from "./value";

export const utils = {
    Ox,
    strip0x,
    randomNonce,
    value,

    // Bitcoin
    BTC: btcUtils,
    btc: btcUtils,

    // Zcash
    ZEC: zecUtils,
    zec: zecUtils,

    // Bitcoin Cash
    BCH: bchUtils,
    bch: bchUtils,
};
