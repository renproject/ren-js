import { Connection, PublicKey, Transaction } from "@solana/web3.js";
import nacl from "tweetnacl";
import { SolanaProvider } from ".";
import { SolNetworkConfig } from "./networks";

export const makeLocalProvider = (
    network: SolNetworkConfig,
): SolanaProvider => {
    const key = nacl.sign.keyPair();

    const pubk = new PublicKey(key.publicKey);
    const provider: SolanaProvider = {
        connection: new Connection(network.endpoint),
        wallet: {
            publicKey: pubk,
            signTransaction: async (x: Transaction) => {
                const sig = nacl.sign(x.serializeMessage(), key.secretKey);
                x.addSignature(pubk, Buffer.from(sig));
                return x;
            },
        },
    };
    return provider;
};
