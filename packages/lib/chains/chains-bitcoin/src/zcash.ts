import { Callable } from "@renproject/utils";
import { Networks, Opcode, Script } from "bitcore-lib-zcash";
import base58 from "bs58";
import {
    getUTXO,
    getUTXOs,
} from "send-crypto/build/main/handlers/ZEC/ZECHandler";
import { validate } from "wallet-address-validator";

import { Address, BitcoinBaseChain, BitcoinNetwork } from "./base";
import { BitcoinChain } from "./bitcoin";
import { createAddress, pubKeyScript } from "./script";

export class ZcashChain extends BitcoinChain {
    public name = "Zec";

    public _asset = "ZEC";
    public _getUTXO = getUTXO;
    public _getUTXOs = getUTXOs;
    public _p2shPrefix = {
        mainnet: Buffer.from([0x1c, 0xbd]),
        testnet: Buffer.from([0x1c, 0xba]),
    };
    public _createAddress = createAddress(
        Networks,
        Opcode,
        Script,
        base58.encode
    );
    public _calculatePubKeyScript = pubKeyScript(Networks, Opcode, Script);
    public _addressIsValid = (address: Address, network: BitcoinNetwork) =>
        validate(address, "zec", network);

    constructor(
        network?: BitcoinNetwork,
        thisClass: typeof BitcoinBaseChain = ZcashChain
    ) {
        super(network, thisClass);
    }
}

export const Zcash = Callable(ZcashChain);
