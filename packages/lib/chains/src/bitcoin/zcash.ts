import { Asset, LockChain } from "@renproject/interfaces";
import { hash160 } from "@renproject/utils";
import { Networks, Opcode, Script } from "bitcore-lib-zcash";
import { UTXO as SendCryptoUTXO } from "send-crypto";
import { getUTXOs } from "send-crypto/build/main/handlers/ZEC/ZECHandler";

import { Callable } from "../class";
import { createAddress, pubKeyScript } from "../common";
import { Transaction } from "./base";
import { BitcoinChain } from "./bitcoin";

// export const createZECAddress = createAddress(Networks, Opcode, Script);

// export const getZcashUTXOs = ({ isTestnet }: { isTestnet: boolean }) => {
//     return async (address: string, confirmations: number) => {
//         return getUTXOs(isTestnet, { address, confirmations });
//     };
// };

// export const getZcashConfirmations = ({
//     isTestnet,
// }: {
//     isTestnet: boolean;
// }) => {
//     return async (txHash: string) => {
//         return getConfirmations(isTestnet, txHash);
//     };
// };

// ZCash shielded addresses (starting with 'z') aren't supported yet.
// export const zecAddressToHex = (address: string) => Ox(Buffer.from(address));

// export const zecAddressToHex = (address: string) => {
//     const addressBuffer = new ZcashAddress(address).toBuffer();
//     // Concatenate checksum
//     return Ox(
//         Buffer.concat([addressBuffer, Base58Check.checksum(addressBuffer)])
//     );
// };

// const isZECAddress = (address: string) =>
//     validate(address, "zec", "testnet") || validate(address, "zec", "prod");

// const zecTactics: Tactics = {
//     decoders: [
//         (address: string) => Buffer.from(address),
//         (address: string) => fromBase64(address),
//         (address: string) => fromHex(address),
//     ],
//     encoders: [
//         (buffer: Buffer) => buffer.toString(),
//         (buffer: Buffer) => encode(buffer), // base58
//     ],
// };

// export const zecAddressFrom = anyAddressFrom(isZECAddress, zecTactics);

type Address = string;

export class ZcashChain
    extends BitcoinChain
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
            hash160(publicKey),
            gHash
        );
    };

    getPubKeyScript = (asset: Asset, publicKey: Buffer, gHash: Buffer) => {
        this.assetAssetSupported(asset);
        return pubKeyScript(Networks, Opcode, Script)(
            this.chainNetwork === "testnet",
            hash160(publicKey),
            gHash
        );
    };

    /**
     * See [[OriginChain.getDeposits]].
     */
    getDeposits = async (
        asset: Asset,
        address: Address
    ): Promise<Transaction[]> => {
        if (this.chainNetwork === "regtest") {
            throw new Error(`Unable to fetch deposits on ${this.chainNetwork}`);
        }
        this.assetAssetSupported(asset);
        return (
            await getUTXOs(this.chainNetwork === "testnet", {
                address,
                confirmations: 0,
            })
        ).map((utxo) => utxo);
    };
}

export const Zcash = Callable(ZcashChain);
