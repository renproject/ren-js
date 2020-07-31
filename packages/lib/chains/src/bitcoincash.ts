import { LockChain } from "@renproject/interfaces";
import { isMainnetAddress, isTestnetAddress, toCashAddress } from "bchaddrjs";
import { Networks, Opcode, Script } from "bitcore-lib-cash";
import { UTXO as SendCryptoUTXO } from "send-crypto";
import {
    getConfirmations,
    getUTXOs,
} from "send-crypto/build/main/handlers/BCH/BCHHandler";

import { anyAddressFrom, Bitcoin, BitcoinNetwork, Tactics } from "./bitcoin";
import { createAddress } from "./common";
import { Ox, strip0x } from "./hexUtils";
import { createZECAddress } from "./zcash";

export const createBCHAddress = createAddress(Networks, Opcode, Script);

export const getBitcoinCashUTXOs = ({ isTestnet }: { isTestnet: boolean }) => {
    return async (address: string, confirmations: number) => {
        return getUTXOs(isTestnet, { address, confirmations });
    };
};

export const getBitcoinCashConfirmations = ({
    isTestnet,
}: {
    isTestnet: boolean;
}) => {
    return async (txHash: string) => {
        return getConfirmations(isTestnet, txHash);
    };
};

export const bchAddressToHex = (address: string) => Ox(Buffer.from(address));

const isBCHAddress = (address: string, options?: { isTestnet?: boolean }) => {
    try {
        return options
            ? options.isTestnet
                ? isTestnetAddress(address)
                : isMainnetAddress(address)
            : isTestnetAddress(address) || isMainnetAddress(address);
    } catch (error) {
        return false;
    }
};

const bchTactics: Tactics = {
    decoders: [
        (address: string) => Buffer.from(address),
        (address: string) => Buffer.from(address, "base64"),
        (address: string) => Buffer.from(strip0x(address), "hex"),
    ],
    encoders: [(buffer: Buffer) => toCashAddress(buffer.toString())],
};

export const bchAddressFrom = anyAddressFrom(isBCHAddress, bchTactics);

export class BitcoinCash extends Bitcoin implements LockChain<SendCryptoUTXO> {
    public name = "Bch";
    // private network: BitcoinNetwork | undefined;

    // public getDeposits = getBitcoinCashUTXOs;
    // public addressToHex = bchAddressToHex;
    // public addressFrom = bchAddressFrom;
    // public getConfirmations = getBitcoinCashConfirmations;
    // public createAddress = createZECAddress;
}
