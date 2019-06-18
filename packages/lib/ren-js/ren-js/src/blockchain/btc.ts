import { Networks, Opcode, Script } from "bitcore-lib";
import { decode as decode58 } from "bs58";

import { masterPKH } from "../darknode/masterKey";
import { createAddress } from "./common";
import { getUTXOs } from "./mercury";

const createBTCAddress = createAddress(Networks, Opcode, Script);

const testnetMercury = "https://ren-mercury.herokuapp.com/btc-testnet3";

export interface BitcoinUTXO {
    txHash: string; // hex string without 0x prefix
    amount: number; // satoshis
    scriptPubKey: string; // hex string without 0x prefix
    vout: number;
}

// tslint:disable-next-line: no-object-literal-type-assertion
// export class BitcoinUTXO extends Record({
//     txHash: "", // hex string without 0x prefix
//     amount: 0, // satoshis
//     scriptPubKey: "", // hex string without 0x prefix
//     vout: 0,
// } as RawUTXO) { }

export const getBTCTestnetUTXOs = getUTXOs<BitcoinUTXO>(testnetMercury);

// async (address: string, limit: number, confirmations: number) => {
//     return (await getUTXOs<RawUTXO>(testnetMercury)(address, limit, confirmations)).map(raw => new BitcoinUTXO(raw));
// };

export const createBTCTestnetAddress = createBTCAddress({ mainnet: false, masterPKH });

export const btcAddressToHex = (address: string) => `0x${decode58(address).toString("hex")}`;
// `0x${(new Address(address)).toBuffer().toString("hex")}`;
