import {
    AbiItem,
    Asset,
    BurnTransaction,
    Chain,
    DepositCommon,
    LockAndMintParams,
    LockChain,
    Logger,
    MintChain,
    MintTransaction,
    RenContract,
    RenNetwork,
    RenNetworkString,
    TxStatus,
} from "@renproject/interfaces";
import { ParallelHttpProvider, Provider } from "@renproject/provider";
import {
    assertType,
    fromBase64,
    fromBigNumber,
    fromHex,
    generateGHash,
    generatePHash,
    generateSHash,
    getTokenPrices,
    normalizeValue,
    SECONDS,
    sha256,
    sleep,
    strip0x,
    toBase64,
    TokenPrices,
    toURLBase64,
} from "@renproject/utils";
import BigNumber from "bignumber.js";
import { List, OrderedMap, Set } from "immutable";

import {
    ParamsQueryBlock,
    ParamsQueryBlocks,
    ParamsQueryTx,
    ParamsQueryTxs,
    ParamsSubmitBurn,
    ParamsSubmitMint,
    RenVMParams,
    RenVMResponses,
    ResponseQueryBurnTx,
    ResponseQueryMintTx,
    RPCMethod,
} from "./methods";
import {
    PackStructType,
    PackTypeDefinition,
    TypedPackValue,
} from "./pack/pack";
import {
    burnParamsType,
    hashTransaction,
    mintParamsType,
    MintTransactionInput,
} from "./transaction";
import { unmarshalBurnTx, unmarshalFees, unmarshalMintTx } from "./unmarshal";

export const resolveRpcURL = (network: RenNetwork | string) => {
    switch (network) {
        case RenNetwork.Mainnet:
            return "https://lightnode-mainnet.herokuapp.com";
        case RenNetwork.Chaosnet:
            return "https://lightnode-chaosnet.herokuapp.com";
        case RenNetwork.Testnet:
            return "https://lightnode-testnet.herokuapp.com";
        case RenNetwork.Devnet:
            return "https://lightnode-devnet.herokuapp.com";
    }
    return network;
};

export const resolveV2Contract = <
    // tslint:disable-next-line: no-any
    Transaction = any,
    Deposit extends DepositCommon<Transaction> = DepositCommon<Transaction>,
    ChainAsset extends string = string,
    Address = string,
    MintAsset extends string = string
>({
    asset,
    from,
    to,
}: {
    asset: ChainAsset;
    from:
        | LockChain<Transaction, Deposit, Asset, Address>
        | MintChain<MintAsset>;
    to: LockChain<Transaction, Deposit, Asset, Address> | MintChain<MintAsset>;
}): string => {
    if (
        (from as LockChain<Transaction, Deposit, Asset, Address>)
            .assetIsNative &&
        (from as LockChain<Transaction, Deposit, Asset, Address>).assetIsNative(
            asset
        )
    ) {
        return `${asset}/to${to.name}`;
    }
    if (
        (to as LockChain<Transaction, Deposit, Asset, Address>).assetIsNative &&
        (to as LockChain<Transaction, Deposit, Asset, Address>).assetIsNative(
            asset
        )
    ) {
        return `${asset}/from${from.name}`;
    }
    return `${asset}/from$${from.name}To${to.name}`;
};

export type RenVMProviderInterface = Provider<RenVMParams, RenVMResponses>;

export class RenVMProvider implements RenVMProviderInterface {
    public version = 2;

    private readonly network: RenNetwork;

    public readonly provider: Provider<RenVMParams, RenVMResponses>;
    sendMessage: RenVMProvider["provider"]["sendMessage"];
    private readonly logger: Logger | undefined;

    constructor(
        network: RenNetwork | RenNetworkString,
        provider?: Provider<RenVMParams, RenVMResponses> | string,
        logger?: Logger
    ) {
        if (!provider || typeof provider === "string") {
            const rpcUrl = provider || resolveRpcURL(network);
            try {
                provider = new ParallelHttpProvider<
                    RenVMParams,
                    RenVMResponses
                >([rpcUrl], logger) as Provider<RenVMParams, RenVMResponses>;
            } catch (error) {
                if (String(error && error.message).match(/Invalid node URL/)) {
                    throw new Error(
                        `Invalid network or provider URL: "${network}"`
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
        retry?: number
    ) =>
        this.sendMessage<RPCMethod.MethodQueryBlock>(
            RPCMethod.MethodQueryBlock,
            { blockHeight },
            retry
        );

    public queryBlocks = async (
        blockHeight: ParamsQueryBlocks["blockHeight"],
        n: ParamsQueryBlocks["n"],
        retry?: number
    ) =>
        this.sendMessage<RPCMethod.MethodQueryBlocks>(
            RPCMethod.MethodQueryBlocks,
            { blockHeight, n },
            retry
        );

    public submitTx = async (
        tx: ParamsSubmitBurn["tx"] | ParamsSubmitMint["tx"],
        retry?: number
    ) =>
        this.sendMessage<RPCMethod.MethodSubmitTx>(
            RPCMethod.MethodSubmitTx,
            // tslint:disable-next-line: no-object-literal-type-assertion
            { tx } as ParamsSubmitBurn | ParamsSubmitMint,
            retry
        );

    public queryTx = async (txHash: ParamsQueryTx["txHash"], retry?: number) =>
        this.sendMessage<RPCMethod.MethodQueryTx>(
            RPCMethod.MethodQueryTx,
            { txHash },
            retry
        );

    public queryTxs = async (
        tags: ParamsQueryTxs["tags"],
        page?: number,
        pageSize?: number,
        txStatus?: ParamsQueryTxs["txStatus"],
        retry?: number
    ) =>
        this.sendMessage<RPCMethod.MethodQueryTxs>(
            RPCMethod.MethodQueryTxs,
            {
                tags,
                page: (page || 0).toString(),
                pageSize: (pageSize || 0).toString(),
                txStatus,
            },
            retry
        );

    public queryNumPeers = async (retry?: number) =>
        this.sendMessage<RPCMethod.MethodQueryNumPeers>(
            RPCMethod.MethodQueryNumPeers,
            {},
            retry
        );

    public queryPeers = async (retry?: number) =>
        this.sendMessage<RPCMethod.MethodQueryPeers>(
            RPCMethod.MethodQueryPeers,
            {},
            retry
        );

    public queryShards = async (retry?: number) =>
        this.sendMessage<RPCMethod.MethodQueryShards>(
            RPCMethod.MethodQueryShards,
            {},
            retry
        );

    public queryStat = async (retry?: number) =>
        this.sendMessage<RPCMethod.MethodQueryStat>(
            RPCMethod.MethodQueryStat,
            {},
            retry
        );

    public queryFees = async (retry?: number) =>
        this.sendMessage<RPCMethod.MethodQueryFees>(
            RPCMethod.MethodQueryFees,
            {},
            retry
        );

    public getFees = async () => unmarshalFees(await this.queryFees());

    public buildMintTransaction = (params: {
        renContractOrSelector: string;
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
            renContractOrSelector,
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
            hash: toURLBase64(
                hashTransaction(version, renContractOrSelector, txIn)
            ),
            selector: renContractOrSelector,
            version,
            // TODO: Fix types
            in: (txIn as unknown) as MintTransactionInput["in"],
        };
    };

    public mintTxHash = (
        renContractOrSelector: string,
        gHash: Buffer,
        gPubKey: Buffer,
        nHash: Buffer,
        nonce: Buffer,
        // tslint:disable-next-line: no-any
        output:
            | { txHash: string; vOut: string }
            | { txindex: string; txid: Buffer },
        amount: string,
        payload: Buffer,
        pHash: Buffer,
        to: string,
        _outputHashString: string
    ): Buffer => {
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
            this.buildMintTransaction({
                renContractOrSelector,
                gHash,
                gPubKey,
                nHash,
                nonce,
                output: { txid, txindex },
                amount,
                payload,
                pHash,
                to,
            }).hash
        );
    };

    public submitMint = async (
        renContractOrSelector: string,
        gHash: Buffer,
        gPubKey: Buffer,
        nHash: Buffer,
        nonce: Buffer,
        // tslint:disable-next-line: no-any
        output: { txindex: string; txid: Buffer },
        amount: string,
        payload: Buffer,
        pHash: Buffer,
        to: string,
        token: string,
        _fn: string,
        _fnABI: AbiItem[],
        _tags: [string] | []
    ): Promise<Buffer> => {
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

        const tx = this.buildMintTransaction({
            renContractOrSelector,
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

        await this.provider.sendMessage<RPCMethod.MethodSubmitTx>(
            RPCMethod.MethodSubmitTx,
            {
                tx,
                // tags,
            }
        );

        return fromBase64(tx.hash);
    };

    public burnTxHash = async (
        params: {
            // v2
            renContractOrSelector: string;
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
        _logger?: Logger
    ): Promise<Buffer> => {
        const {
            renContractOrSelector,
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
            renContractOrSelector: string;
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
            renContractOrSelector,
            to,
            txindex: output.txindex,
            amount,
        });

        const tx = this.buildMintTransaction({
            renContractOrSelector,
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
                  renContractOrSelector: string;
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
                  renContract: RenContract;
                  burnNonce: BigNumber;
              },
        _tags: [string] | [],
        _logger?: Logger
    ): Promise<Buffer> => {
        const {
            renContractOrSelector,
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
            renContractOrSelector: string;
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
            renContractOrSelector,
            to,
            txindex: output.txindex,
            amount,
        });

        const tx = this.buildMintTransaction({
            renContractOrSelector,
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

        await this.provider.sendMessage(RPCMethod.MethodSubmitTx, {
            tx,
            // tags,
        });

        return fromBase64(tx.hash);
    };

    public readonly queryMintOrBurn = async <
        T extends MintTransaction | BurnTransaction
    >(
        renVMTxHash: Buffer
    ): Promise<T> => {
        try {
            const response = await this.queryTx(toURLBase64(renVMTxHash));

            // Unmarshal transaction.
            // TODO: Improve mint/burn detection. Currently checks if the format
            // is `ASSET/toChain` or `ASSET/fromChainToChain`. It may return
            // a false positive if the chain name contains `To`.
            const isMint = response.tx.selector.match(/((\/to)|(To))/);

            if (isMint) {
                return unmarshalMintTx(response as ResponseQueryMintTx) as T;
            } else {
                return unmarshalBurnTx(response as ResponseQueryBurnTx) as T;
            }
        } catch (error) {
            console.error(error);
            throw error;
        }
    };

    public readonly waitForTX = async <
        T extends MintTransaction | BurnTransaction
    >(
        utxoTxHash: Buffer,
        onStatus?: (status: TxStatus) => void,
        _cancelRequested?: () => boolean
    ): Promise<T> => {
        assertType<Buffer>("Buffer", { utxoTxHash });
        let rawResponse;
        // tslint:disable-next-line: no-constant-condition
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
                // tslint:disable-next-line: no-console
                if (
                    String((error || {}).message).match(
                        /(not found)|(not available)/
                    )
                ) {
                    // ignore
                } else {
                    // tslint:disable-next-line: no-console
                    if (this.logger) {
                        this.logger.error(String(error));
                    }
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
     * @param {RenContract} renContract The Ren Contract for which the public
     *        key should be fetched.
     * @returns The public key hash (20 bytes) as a string.
     */
    public readonly selectPublicKey = async (
        token: Asset,
        logger?: Logger
    ): Promise<Buffer> => {
        // Call the ren_queryShards RPC.
        const response = await this.queryShards(5);

        // Filter to only keep shards that are primary/online.
        const primaryShards = response.shards.filter(shard => shard.primary);

        // Find the shard with the lowest total value locked (sum all the locked
        // amounts from all gateways in a shard, after converting to a consistent
        // currencies using the coinGecko API).
        const tokens = Set<string>()
            .concat(
                ...primaryShards.map(shard =>
                    shard.gateways.map(gateway => gateway.asset)
                )
            )
            .toArray();
        const tokenPrices: TokenPrices = await getTokenPrices(
            tokens,
            logger
        ).catch(() => OrderedMap());

        const smallestShard = List(primaryShards)
            .filter(shard =>
                shard.gateways.map(gateway => gateway.asset).includes(token)
            )
            .sortBy(shard =>
                shard.gateways
                    .map(gateway =>
                        normalizeValue(
                            tokenPrices,
                            gateway.asset,
                            gateway.locked
                        )
                    )
                    .reduce((sum, value) => sum.plus(value), new BigNumber(0))
                    .toNumber()
            )
            .first(undefined);

        if (!smallestShard) {
            throw new Error(
                "Unable to load public key from RenVM: no shards found"
            );
        }

        // Get the gateway pubKey from the gateway with the right asset within
        // the shard with the lowest total value locked.
        const tokenGateway = List(smallestShard.gateways)
            .filter(gateway => gateway.asset === token)
            .first(undefined);

        if (!tokenGateway) {
            throw new Error(
                `Unable to load public key from RenVM: no gateway for the asset ${token}`
            );
        }

        // Use this gateway pubKey to build the gateway address.
        // return hash160(
        return fromBase64(tokenGateway.pubKey);
        // );
    };

    // In the future, this will be asynchronous. It returns a promise for
    // compatibility.
    public getNetwork = async (): Promise<string> => {
        return this.network;
    };
}
