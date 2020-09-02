import { Asset, LockChain } from "@renproject/interfaces";
import { hash160 } from "@renproject/utils";
import { Networks, Opcode, Script } from "bitcore-lib-cash";
import { UTXO as SendCryptoUTXO } from "send-crypto";
import { getUTXOs } from "send-crypto/build/main/handlers/BCH/BCHHandler";

import { Callable } from "../class";
import { createAddress, pubKeyScript } from "../common";
import { Transaction } from "./base";
import { BitcoinChain } from "./bitcoin";

export const createBCHAddress = createAddress(Networks, Opcode, Script);

// export const getBitcoinCashUTXOs = ({ isTestnet }: { isTestnet: boolean }) => {
//     return async (address: string, confirmations: number) => {
//         return getUTXOs(isTestnet, { address, confirmations });
//     };
// };

// export const getBitcoinCashConfirmations = ({
//     isTestnet,
// }: {
//     isTestnet: boolean;
// }) => {
//     return async (txHash: string) => {
//         return getConfirmations(isTestnet, txHash);
//     };
// };

// export const bchAddressToHex = (address: string) => Ox(Buffer.from(address));

// const isBCHAddress = (address: string, options?: { isTestnet?: boolean }) => {
//     try {
//         return options
//             ? options.isTestnet
//                 ? isTestnetAddress(address)
//                 : isMainnetAddress(address)
//             : isTestnetAddress(address) || isMainnetAddress(address);
//     } catch (error) {
//         return false;
//     }
// };

// const bchTactics: Tactics = {
//     decoders: [
//         (address: string) => Buffer.from(address),
//         (address: string) => fromBase64(address),
//         (address: string) => fromHex(address),
//     ],
//     encoders: [(buffer: Buffer) => toCashAddress(buffer.toString())],
// };

// export const bchAddressFrom = anyAddressFrom(isBCHAddress, bchTactics);

type Address = string;

export class BitcoinCashChain
    extends BitcoinChain
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

export const BitcoinCash = Callable(BitcoinCashChain);
