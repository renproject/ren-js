import { Asset, LockChain } from "@renproject/interfaces";
import { hash160 } from "@renproject/utils";
import {
    Address as ZcashAddress,
    Networks,
    Opcode,
    Script,
} from "bitcore-lib-zcash";
import Base58Check from "bitcore-lib-zcash/lib/encoding/base58check";
import { encode } from "bs58";
import { UTXO as SendCryptoUTXO } from "send-crypto";
import {
    getConfirmations,
    getUTXOs,
} from "send-crypto/build/main/handlers/ZEC/ZECHandler";
import { validate } from "wallet-address-validator";

import { anyAddressFrom, BitcoinChain, Tactics } from "./bitcoin";
import { Callable } from "./class";
import { createAddress, pubKeyScript } from "./common";
import { Ox, strip0x } from "./hexUtils";

export const createZECAddress = createAddress(Networks, Opcode, Script);

export const getZcashUTXOs = ({ isTestnet }: { isTestnet: boolean }) => {
    return async (address: string, confirmations: number) => {
        return getUTXOs(isTestnet, { address, confirmations });
    };
};

export const getZcashConfirmations = ({
    isTestnet,
}: {
    isTestnet: boolean;
}) => {
    return async (txHash: string) => {
        return getConfirmations(isTestnet, txHash);
    };
};

// ZCash shielded addresses (starting with 'z') aren't supported yet.
// export const zecAddressToHex = (address: string) => Ox(Buffer.from(address));

export const zecAddressToHex = (address: string) => {
    const addressBuffer = new ZcashAddress(address).toBuffer();
    // Concatenate checksum
    return Ox(
        Buffer.concat([addressBuffer, Base58Check.checksum(addressBuffer)])
    );
};

const isZECAddress = (address: string) =>
    validate(address, "zec", "testnet") || validate(address, "zec", "prod");

const zecTactics: Tactics = {
    decoders: [
        (address: string) => Buffer.from(address),
        (address: string) => Buffer.from(address, "base64"),
        (address: string) => Buffer.from(strip0x(address), "hex"),
    ],
    encoders: [
        (buffer: Buffer) => buffer.toString(),
        (buffer: Buffer) => encode(buffer), // base58
    ],
};

export const zecAddressFrom = anyAddressFrom(isZECAddress, zecTactics);

type Address = string;

export class ZcashChain extends BitcoinChain
    implements LockChain<SendCryptoUTXO> {
    public name = "Zec";

    // Supported assets
    supportsAsset = (asset: string) => asset === "ZEC";
    assetDecimals = (asset: string) => {
        if (asset === "ZEC") {
            return 8;
        }
        throw new Error(`Unsupported token ${asset}`);
    };

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

    // public getDeposits = getZcashUTXOs;
    // public addressToHex = zecAddressToHex;
    // public addressFrom = zecAddressFrom;
    // public getConfirmations = getZcashConfirmations;
    // public createAddress = createZECAddress;
}

export const Zcash = Callable(ZcashChain);
