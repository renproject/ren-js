import { Asset, LockChain } from "@renproject/interfaces";
import { hash160 } from "@renproject/utils";
import { isMainnetAddress, isTestnetAddress, toCashAddress } from "bchaddrjs";
import { Networks, Opcode, Script } from "bitcore-lib-cash";
import { UTXO as SendCryptoUTXO } from "send-crypto";
import {
    getConfirmations,
    getUTXOs,
} from "send-crypto/build/main/handlers/BCH/BCHHandler";

import { anyAddressFrom, BitcoinChain, Tactics } from "./bitcoin";
import { Callable } from "./class";
import { createAddress, pubKeyScript } from "./common";
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

type Address = string;

export class BitcoinCashChain extends BitcoinChain
    implements LockChain<SendCryptoUTXO> {
    public name = "Bch";
    // private network: BitcoinNetwork | undefined;

    getGatewayAddress = (
        asset: Asset,
        publicKey: Buffer,
        gHash: Buffer
    ): Promise<Address> | Address => {
        this.assetAssetSupported(asset);
        return createAddress(Networks, Opcode, Script)(
            this.chainNetwork === "testnet",
            hash160(publicKey).toString("hex"),
            gHash.toString("hex")
        );
    };

    getPubKeyScript = (asset: Asset, publicKey: Buffer, gHash: Buffer) => {
        this.assetAssetSupported(asset);
        return pubKeyScript(Networks, Opcode, Script)(
            this.chainNetwork === "testnet",
            hash160(publicKey).toString("hex"),
            gHash.toString("hex")
        );
    };

    // public getDeposits = getBitcoinCashUTXOs;
    // public addressToHex = bchAddressToHex;
    // public addressFrom = bchAddressFrom;
    // public getConfirmations = getBitcoinCashConfirmations;
    // public createAddress = createZECAddress;
}

export const BitcoinCash = Callable(BitcoinCashChain);
