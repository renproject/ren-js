import { Networks, Opcode, Script } from "bitcore-lib-dogecoin";
import base58 from "bs58";
import {
    getUTXO,
    getUTXOs,
} from "send-crypto/build/main/handlers/DOGE/DOGEHandler";
import { validate } from "wallet-address-validator";

import { Callable } from "../class";
import { BitcoinBaseChain, BitcoinNetwork } from "./base";
import { BitcoinChain } from "./bitcoin";
import { createAddress, pubKeyScript } from "./script";

export class DogecoinChain extends BitcoinChain {
    public name = "Doge";

    public _asset = "DOGE";
    public _getUTXO = getUTXO;
    public _getUTXOs = getUTXOs;
    public _p2shPrefix = {
        mainnet: Buffer.from([0x16]),
        testnet: Buffer.from([0xc4]),
    };
    public _createAddress = createAddress(
        Networks,
        Opcode,
        Script,
        base58.encode
    );
    public _calculatePubKeyScript = pubKeyScript(Networks, Opcode, Script);
    public _addressIsValid = (address: string, network: BitcoinNetwork) =>
        validate(address, this._asset.toLowerCase(), network);

    constructor(
        network?: BitcoinNetwork,
        thisClass: typeof BitcoinBaseChain = DogecoinChain
    ) {
        super(network, thisClass);
    }
}

export const Dogecoin = Callable(DogecoinChain);
