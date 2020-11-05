import {
    BurnAndReleaseTransaction,
    getRenNetworkDetails,
    LockAndMintTransaction,
    LockChain,
    Logger,
    MintChain,
    NullLogger,
    RenNetwork,
    RenNetworkDetails,
    RenNetworkString,
    TxStatus,
} from "@renproject/interfaces";
import { HttpProvider, Provider } from "@renproject/provider";
import {
    assertType,
    fromBase64,
    SECONDS,
    sleep,
    toURLBase64,
} from "@renproject/utils";
import BigNumber from "bignumber.js";

import { AbstractRenVMProvider } from "../abstract";
import {
    ParamsQueryBlock,
    ParamsQueryBlocks,
    ParamsQueryTx,
    ParamsQueryTxs,
    ParamsSubmitBurn,
    ParamsSubmitMint,
    RenVMParams,
    RenVMResponses,
    RPCMethod,
} from "./methods";
import {
    hashTransaction,
    mintParamsType,
    MintTransactionInput,
} from "./transaction";
import { unmarshalBurnTx, unmarshalMintTx } from "./unmarshal";

export const resolveV2Contract = ({
    asset,
    from,
    to,
}: {
    asset: string;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    from: LockChain<any, any, any> | MintChain<any, any>;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    to: LockChain<any, any, any> | MintChain<any, any>;
}): string => {
    if (
        (from as LockChain).assetIsNative &&
        (from as LockChain).assetIsNative(asset)
    ) {
        return `${asset}/to${to.name}`;
    }
    if (
        (to as LockChain).assetIsNative &&
        (to as LockChain).assetIsNative(asset)
    ) {
        return `${asset}/from${from.name}`;
    }
    return `${asset}/from$${from.name}To${to.name}`;
};

export class RenVMProvider
    implements AbstractRenVMProvider<RenVMParams, RenVMResponses> {
    public version = 2;

    private readonly network: RenNetwork;

    public readonly provider: Provider<RenVMParams, RenVMResponses>;
    sendMessage: RenVMProvider["provider"]["sendMessage"];
    private readonly logger: Logger;

    constructor(
        network: RenNetwork | RenNetworkString | RenNetworkDetails,
        provider?: Provider<RenVMParams, RenVMResponses> | string,
        logger: Logger = NullLogger,
    ) {
        if (!provider || typeof provider === "string") {
            const rpcUrl = provider || getRenNetworkDetails(network).lightnode;
            try {
                provider = new HttpProvider<RenVMParams, RenVMResponses>(
                    rpcUrl,
                    logger,
                ) as Provider<RenVMParams, RenVMResponses>;
            } catch (error) {
                if (/Invalid node URL/.exec(String(error && error.message))) {
                    throw new Error(
                        `Invalid network or provider URL: "${
                            getRenNetworkDetails(network).name
                        }"`,
                    );
                }
                throw error;
            }
        }

        this.network = network as RenNetwork;
        this.logger = logger;
        this.provider = provider;
        this.sendMessage = this.provider.sendMessage;
    }

    public queryBlock = async (
        blockHeight: ParamsQueryBlock["blockHeight"],
        retry?: number,
    ) =>
        this.sendMessage<RPCMethod.QueryBlock>(
            RPCMethod.QueryBlock,
            { blockHeight },
            retry,
        );

    public queryBlocks = async (
        blockHeight: ParamsQueryBlocks["blockHeight"],
        n: ParamsQueryBlocks["n"],
        retry?: number,
    ) =>
        this.sendMessage<RPCMethod.QueryBlocks>(
            RPCMethod.QueryBlocks,
            { blockHeight, n },
            retry,
        );

    public submitTx = async (
        tx: ParamsSubmitBurn["tx"] | ParamsSubmitMint["tx"],
        retry?: number,
    ) =>
        this.sendMessage<RPCMethod.SubmitTx>(
            RPCMethod.SubmitTx,
            { tx } as ParamsSubmitBurn | ParamsSubmitMint,
            retry,
        );

    public queryTx = async (txHash: ParamsQueryTx["txHash"], retry?: number) =>
        this.sendMessage<RPCMethod.QueryTx>(
            RPCMethod.QueryTx,
            { txHash },
            retry,
        );

    public queryTxs = async (
        tags: ParamsQueryTxs["tags"],
        page?: number,
        pageSize?: number,
        txStatus?: ParamsQueryTxs["txStatus"],
        retry?: number,
    ) =>
        this.sendMessage<RPCMethod.QueryTxs>(
            RPCMethod.QueryTxs,
            {
                tags,
                page: (page || 0).toString(),
                pageSize: (pageSize || 0).toString(),
                txStatus,
            },
            retry,
        );

    public queryConfig = async (retry?: number) =>
        this.sendMessage<RPCMethod.QueryConfig>(
            RPCMethod.QueryConfig,
            {},
            retry,
        );

    public queryState = async (retry?: number) =>
        this.sendMessage<RPCMethod.QueryState>(RPCMethod.QueryState, {}, retry);

    public getFees = async () => {};

    public buildTransaction = (params: {
        selector: string;
        gHash: Buffer;
        gPubKey: Buffer;
        nHash: Buffer;
        nonce: Buffer;
        output: { txid: Buffer; txindex: string };
        amount: string;
        payload: Buffer;
        pHash: Buffer;
        to: string;
    }): MintTransactionInput => {
        const {
            selector,
            gHash,
            gPubKey,
            nHash,
            nonce,
            output,
            amount,
            payload,
            pHash,
            to,
        } = params;
        assertType<Buffer>("Buffer", {
            gHash,
            gPubKey,
            nHash,
            nonce,
            payload,
            pHash,
            txid: output.txid,
        });
        assertType<string>("string", { to, amount, txindex: output.txindex });
        const version = "1";
        const txIn = {
            t: mintParamsType(),
            v: {
                txid: toURLBase64(output.txid),
                txindex: output.txindex,
                ghash: toURLBase64(gHash),
                gpubkey: toURLBase64(gPubKey),
                nhash: toURLBase64(nHash),
                nonce: toURLBase64(nonce),
                payload: toURLBase64(payload),
                phash: toURLBase64(pHash),
                to,
                amount,
            },
        };
        return {
            hash: toURLBase64(hashTransaction(version, selector, txIn)),
            selector: selector,
            version,
            // TODO: Fix types
            in: (txIn as unknown) as MintTransactionInput["in"],
        };
    };

    public mintTxHash = ({
        selector,
        gHash,
        gPubKey,
        nHash,
        nonce,
        output,
        amount,
        payload,
        pHash,
        to,
    }: {
        selector: string;
        gHash: Buffer;
        gPubKey: Buffer;
        nHash: Buffer;
        nonce: Buffer;
        output:
            | { txHash: string; vOut: string }
            | { txindex: string; txid: Buffer };
        amount: string;
        payload: Buffer;
        pHash: Buffer;
        to: string;
    }): Buffer => {
        assertType<Buffer>("Buffer", {
            gHash,
            gPubKey,
            nHash,
            nonce,
            payload,
            pHash,
        });
        assertType<string>("string", { to });

        const { txid, txindex } = output as { txid: Buffer; txindex: string };
        assertType<Buffer>("Buffer", { txid });
        assertType<string>("string", { txindex });

        return fromBase64(
            this.buildTransaction({
                selector: selector,
                gHash,
                gPubKey,
                nHash,
                nonce,
                output: { txid, txindex },
                amount,
                payload,
                pHash,
                to,
            }).hash,
        );
    };

    public submitMint = async ({
        selector,
        gHash,
        gPubKey,
        nHash,
        nonce,
        output,
        amount,
        payload,
        pHash,
        to,
        token,
    }: {
        selector: string;
        gHash: Buffer;
        gPubKey: Buffer;
        nHash: Buffer;
        nonce: Buffer;
        output: { txindex: string; txid: Buffer };
        amount: string;
        payload: Buffer;
        pHash: Buffer;
        to: string;
        token: string;
    }): Promise<Buffer> => {
        const { txid, txindex } = output;

        assertType<Buffer>("Buffer", {
            gHash,
            gPubKey,
            nHash,
            nonce,
            payload,
            pHash,
            txid,
        });
        assertType<string>("string", { to, token, txindex, amount });

        const tx = this.buildTransaction({
            selector,
            gHash,
            gPubKey,
            nHash,
            nonce,
            output: { txid, txindex },
            amount,
            payload,
            pHash,
            to,
        });

        await this.provider.sendMessage<RPCMethod.SubmitTx>(
            RPCMethod.SubmitTx,
            {
                tx,
                // tags,
            },
        );

        return fromBase64(tx.hash);
    };

    public burnTxHash = (
        params: {
            // v2
            selector: string;
            gHash: Buffer;
            gPubKey: Buffer;
            nHash: Buffer;
            nonce: Buffer;
            output: { txid: Buffer; txindex: string };
            amount: string;
            payload: Buffer;
            pHash: Buffer;
            to: string;
        },
        _logger: Logger = NullLogger,
        // eslint-disable-next-line @typescript-eslint/require-await
    ): Buffer => {
        const {
            selector,
            gHash,
            gPubKey,
            nHash,
            nonce,
            output,
            amount,
            payload,
            pHash,
            to,
        } = params as {
            // v2
            selector: string;
            gHash: Buffer;
            gPubKey: Buffer;
            nHash: Buffer;
            nonce: Buffer;
            output: { txid: Buffer; txindex: string };
            amount: string;
            payload: Buffer;
            pHash: Buffer;
            to: string;
        };

        assertType<Buffer>("Buffer", {
            gHash,
            gPubKey,
            nHash,
            nonce,
            payload,
            pHash,
            txid: output.txid,
        });
        assertType<string>("string", {
            selector,
            to,
            txindex: output.txindex,
            amount,
        });

        const tx = this.buildTransaction({
            selector,
            gHash,
            gPubKey,
            nHash,
            nonce,
            output,
            amount,
            payload,
            pHash,
            to,
        });

        return fromBase64(tx.hash);
    };

    public submitBurn = async (
        params:
            | {
                  // v2
                  selector: string;
                  gHash: Buffer;
                  gPubKey: Buffer;
                  nHash: Buffer;
                  nonce: Buffer;
                  output: { txid: Buffer; txindex: string };
                  amount: string;
                  payload: Buffer;
                  pHash: Buffer;
                  to: string;
              }
            | {
                  // v1
                  selector: string;
                  burnNonce: BigNumber;
              },
        _tags: [string] | [],
        _logger: Logger = NullLogger,
    ): Promise<Buffer> => {
        const {
            selector,
            gHash,
            gPubKey,
            nHash,
            nonce,
            output,
            amount,
            payload,
            pHash,
            to,
        } = params as {
            // v2
            selector: string;
            gHash: Buffer;
            gPubKey: Buffer;
            nHash: Buffer;
            nonce: Buffer;
            output: { txid: Buffer; txindex: string };
            amount: string;
            payload: Buffer;
            pHash: Buffer;
            to: string;
        };

        assertType<Buffer>("Buffer", {
            gHash,
            gPubKey,
            nHash,
            nonce,
            payload,
            pHash,
            txid: output.txid,
        });
        assertType<string>("string", {
            selector,
            to,
            txindex: output.txindex,
            amount,
        });

        const tx = this.buildTransaction({
            selector,
            gHash,
            gPubKey,
            nHash,
            nonce,
            output,
            amount,
            payload,
            pHash,
            to,
        });

        await this.provider.sendMessage(RPCMethod.SubmitTx, {
            tx,
            // tags,
        });

        return fromBase64(tx.hash);
    };

    public readonly queryMintOrBurn = async <
        T extends LockAndMintTransaction | BurnAndReleaseTransaction
    >(
        renVMTxHash: Buffer,
    ): Promise<T> => {
        try {
            const response = await this.queryTx(toURLBase64(renVMTxHash));

            // Unmarshal transaction.
            // TODO: Improve mint/burn detection. Currently checks if the format
            // is `ASSET/toChain` or `ASSET/fromChainToChain`. It may return
            // a false positive if the chain name contains `To`.
            const isMint = /((\/to)|(To))/.exec(response.tx.selector);

            if (isMint) {
                return unmarshalMintTx(response) as T;
            } else {
                return unmarshalBurnTx(response) as T;
            }
        } catch (error) {
            console.error(error);
            throw error;
        }
    };

    public readonly waitForTX = async <
        T extends LockAndMintTransaction | BurnAndReleaseTransaction
    >(
        utxoTxHash: Buffer,
        onStatus?: (status: TxStatus) => void,
        _cancelRequested?: () => boolean,
    ): Promise<T> => {
        assertType<Buffer>("Buffer", { utxoTxHash });
        let rawResponse;
        while (true) {
            if (_cancelRequested && _cancelRequested()) {
                throw new Error(`waitForTX cancelled`);
            }

            try {
                const result = await this.queryMintOrBurn<T>(utxoTxHash);
                if (result && result.txStatus === TxStatus.TxStatusDone) {
                    rawResponse = result;
                    break;
                } else if (onStatus && result && result.txStatus) {
                    onStatus(result.txStatus);
                }
            } catch (error) {
                if (
                    /(not found)|(not available)/.exec(
                        String((error || {}).message),
                    )
                ) {
                    // ignore
                } else {
                    this.logger.error(String(error));
                    // TODO: throw unexpected errors
                }
            }
            await sleep(15 * SECONDS);
        }
        return rawResponse;
    };

    /**
     * selectPublicKey fetches the public key for the RenVM shard handling
     * the provided contract.
     *
     * @param chain The chain for which the public key should be fetched.
     * @returns The public key hash (20 bytes) as a string.
     */
    public readonly selectPublicKey = async (
        chain: string,
    ): Promise<Buffer> => {
        // Call the ren_queryShards RPC.
        const response = await this.queryState(5);
        return fromBase64(response.state[chain].pubKey);
    };

    // In the future, this will be asynchronous. It returns a promise for
    // compatibility.
    // eslint-disable-next-line @typescript-eslint/require-await
    public getNetwork = async (): Promise<RenNetwork> => {
        return this.network;
    };
}
