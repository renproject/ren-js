import { Networks, Opcode, Script } from "bitcore-lib-zcash";
import { decode as decode58 } from "bs58";

import { Network } from "../types/networks";
import { createAddress, Ox } from "./common";
import { getUTXOs } from "./mercury";

export const createZECAddress = createAddress(Networks, Opcode, Script);

export interface ZcashUTXO {
    txHash: string; // hex string without 0x prefix
    amount: number; // satoshis
    scriptPubKey: string; // hex string without 0x prefix
    vout: number;
}

export const getZcashUTXOs = (network: Network) => getUTXOs<ZcashUTXO>(network.mercuryURL.zec);

export const zecAddressToHex = (address: string) => Ox(decode58(address));
