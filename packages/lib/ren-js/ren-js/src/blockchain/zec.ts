import { Networks, Opcode, Script } from "bitcore-lib-zcash";
import { decode as decode58 } from "bs58";

import { masterKeys, NETWORK } from "../networks";
import { createAddress, Ox } from "./common";
import { getUTXOs } from "./mercury";

const createZECAddress = createAddress(Networks, Opcode, Script);

const testnetMercury = "https://ren-mercury.herokuapp.com/zec-testnet";

export interface ZcashUTXO {
    txHash: string; // hex string without 0x prefix
    amount: number; // satoshis
    scriptPubKey: string; // hex string without 0x prefix
    vout: number;
}

export const getZECTestnetUTXOs = getUTXOs<ZcashUTXO>(testnetMercury);

export const createZECTestnetAddress = createZECAddress({ mainnet: false, masterPKH: Buffer.from(masterKeys[NETWORK].mpkh, "hex") });

export const zecAddressToHex = (address: string) => Ox(decode58(address));
