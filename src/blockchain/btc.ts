import { Networks, Opcode, Script } from "bitcore-lib";
import { decode as decode58 } from "bs58";

import { masterPKH } from "../darknode/masterKey";
import { createAddress, Ox } from "./common";
import { getUTXOs } from "./mercury";

const createBTCAddress = createAddress(Networks, Opcode, Script);

const testnetMercury = "https://ren-mercury.herokuapp.com/btc-testnet3";

export interface BitcoinUTXO {
    txHash: string; // hex string without 0x prefix
    amount: number; // satoshis
    scriptPubKey: string; // hex string without 0x prefix
    vout: number;
}

export const getBTCTestnetUTXOs = getUTXOs<BitcoinUTXO>(testnetMercury);

export const createBTCTestnetAddress = createBTCAddress({ mainnet: false, masterPKH });

export const btcAddressToHex = (address: string) => Ox(decode58(address));
