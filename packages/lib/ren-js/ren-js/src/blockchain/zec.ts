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

// tslint:disable-next-line: no-object-literal-type-assertion
// export class ZcashUTXO extends Record({
//     txHash: "", // hex string without 0x prefix
//     amount: 0, // satoshis
//     scriptPubKey: "", // hex string without 0x prefix
//     vout: 0,
// } as RawUTXO) { }

export const getZECTestnetUTXOs = getUTXOs<ZcashUTXO>(testnetMercury);

// export const getZECTestnetUTXOs = async (address: string, limit: number, confirmations: number) => {
//     return (await getUTXOs<RawUTXO>(testnetMercury)(address, limit, confirmations)).map(raw => new ZcashUTXO(raw));
// };

export const createZECTestnetAddress = createZECAddress({ mainnet: false, masterPKH });

export const zecAddressToHex = (address: string) => `0x${decode58(address).toString("hex")}`;
// `0x${(new Address(address)).toBuffer().toString("hex")}`;
