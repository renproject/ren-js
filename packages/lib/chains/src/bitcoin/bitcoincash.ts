import { toCashAddress } from "bchaddrjs";
import { Networks, Opcode, Script } from "bitcore-lib-cash";
import base58 from "bs58";
import {
    getUTXO,
    getUTXOs,
} from "send-crypto/build/main/handlers/BCH/BCHHandler";
import { validate } from "wallet-address-validator";

import { Callable } from "../class";
import { BitcoinBaseChain, BitcoinNetwork } from "./base";
import { BitcoinChain } from "./bitcoin";
import { createAddress, pubKeyScript } from "./script";

export class BitcoinCashChain extends BitcoinChain {
    public name = "Bch";

    public _asset = "BCH";
    public _getUTXO = getUTXO;
    public _getUTXOs = getUTXOs;
    public _createAddress = createAddress(
        Networks,
        Opcode,
        Script,
        (bytes: Buffer) => toCashAddress(base58.encode(bytes))
    );
    public _calculatePubKeyScript = pubKeyScript(Networks, Opcode, Script);
    public _addressIsValid = (address: string, network: BitcoinNetwork) =>
        validate(address, this._asset.toLowerCase(), network);

    constructor(
        network?: BitcoinNetwork,
        thisClass: typeof BitcoinBaseChain = BitcoinCashChain
    ) {
        super(network, thisClass);
    }
}

export const BitcoinCash = Callable(BitcoinCashChain);
