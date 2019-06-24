import { Networks, Opcode, Script } from "bitcore-lib-zcash";
import { decode as decode58 } from "bs58";

import { masterPKH } from "../darknode/masterKey";
import { createAddress } from "./common";
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

export const createZECTestnetAddress = createZECAddress({ mainnet: false, masterPKH });

export const zecAddressToHex = (address: string) => `0x${decode58(address).toString("hex")}`;
