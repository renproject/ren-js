import { Connection, PublicKey, Transaction } from "@solana/web3.js";
import nacl from "tweetnacl";
import { SolanaProvider } from ".";
import { SolNetworkConfig } from "./networks";

export const makeTestProvider = (
    network: SolNetworkConfig,
    privatekey: Uint8Array,
): SolanaProvider => {
    const key = nacl.sign.keyPair.fromSecretKey(privatekey);

    const pubk = new PublicKey(key.publicKey);
    const provider: SolanaProvider = {
        connection: new Connection(network.endpoint),
        wallet: {
            publicKey: pubk,
            signTransaction: async (x: Transaction) => {
                const sig = nacl.sign.detached(
                    x.serializeMessage(),
                    key.secretKey,
                );
                x.addSignature(pubk, Buffer.from(sig));
                return x;
            },
        },
    };
    return provider;
};
