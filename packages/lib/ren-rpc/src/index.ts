import { RenNetworkDetails } from "@renproject/contracts";
import { AbiItem, Asset, RenContract, RenVMType, TxStatus } from "@renproject/interfaces";
import { Provider } from "@renproject/provider";
import {
    getTokenPrices, hash160, normalizeValue, parseRenContract, SECONDS, sleep, strip0x,
    syncGetTokenAddress, toBase64, TokenPrices,
} from "@renproject/utils";
import BigNumber from "bignumber.js";
import { List, OrderedMap, Set } from "immutable";

import {
    ParamsQueryBlock, ParamsQueryBlocks, ParamsQueryTx, ParamsSubmitBurn, ParamsSubmitMint,
    RenVMParams, RenVMResponses, ResponseQueryBurnTx, ResponseQueryMintTx, RPCMethod,
} from "./renVMTypes";

export * from "./renVMTypes";
export * from "./transaction";
export * from "./unmarshal";

export class RenVMProvider implements Provider<RenVMParams, RenVMResponses> {
    public readonly provider: Provider<RenVMParams, RenVMResponses>;
    sendMessage: RenVMProvider["provider"]["sendMessage"];

    constructor(provider: Provider<RenVMParams, RenVMResponses>) {
        this.provider = provider;
        this.sendMessage = this.provider.sendMessage;
    }

    public queryBlock = async (blockHeight: ParamsQueryBlock["blockHeight"], retry?: number) =>
        this.sendMessage<RPCMethod.MethodQueryBlock>(RPCMethod.MethodQueryBlock, { blockHeight }, retry)

    public queryBlocks = async (blockHeight: ParamsQueryBlocks["blockHeight"], n: ParamsQueryBlocks["n"], retry?: number) =>
        this.sendMessage<RPCMethod.MethodQueryBlocks>(RPCMethod.MethodQueryBlocks, { blockHeight, n }, retry)

    public submitTx = async (tx: ParamsSubmitBurn["tx"] | ParamsSubmitMint["tx"], retry?: number) =>
        // tslint:disable-next-line: no-object-literal-type-assertion
        this.sendMessage<RPCMethod.MethodSubmitTx>(RPCMethod.MethodSubmitTx, { tx } as ParamsSubmitBurn | ParamsSubmitMint, retry)

    public queryTx = async (txHash: ParamsQueryTx["txHash"], retry?: number) =>
        this.sendMessage<RPCMethod.MethodQueryTx>(RPCMethod.MethodQueryTx, { txHash }, retry)

    public queryNumPeers = async (retry?: number) =>
        this.sendMessage<RPCMethod.MethodQueryNumPeers>(RPCMethod.MethodQueryNumPeers, {}, retry)

    public queryPeers = async (retry?: number) =>
        this.sendMessage<RPCMethod.MethodQueryPeers>(RPCMethod.MethodQueryPeers, {}, retry)

    public queryShards = async (retry?: number) =>
        this.sendMessage<RPCMethod.MethodQueryShards>(RPCMethod.MethodQueryShards, {}, retry)

    public queryStat = async (retry?: number) =>
        this.sendMessage<RPCMethod.MethodQueryStat>(RPCMethod.MethodQueryStat, {}, retry)

    public submitMint = async (
        renContract: RenContract,
        to: string,
        nonce: string,
        utxoTxHash: string,
        utxoVout: string,
        network: RenNetworkDetails,
        fn: string,
        fnABI: AbiItem[],
        encodedParameters: string,
    ): Promise<string> => {
        const token = syncGetTokenAddress(renContract, network);
        const response = await this.provider.sendMessage<RPCMethod.MethodSubmitTx>(RPCMethod.MethodSubmitTx,
            {
                tx: {
                    to: renContract,
                    in: [
                        //
                        {
                            name: "p" as const, type: RenVMType.ExtEthCompatPayload, value: {
                                abi: toBase64(Buffer.from(JSON.stringify(fnABI))),
                                value: toBase64(encodedParameters),
                                fn: toBase64(Buffer.from(fn)),
                            }
                        },
                        // The hash of the payload data
                        // { name: "phash" as const, type: RenVMType.TypeB32 as const, value: toBase64(pHash) },
                        // The amount of BTC (in SATs) that has be transferred to the gateway
                        // { name: "amount" as const, type: "u64", as const value: amount },
                        // The ERC20 contract address on Ethereum for BTC
                        { name: "token" as const, type: RenVMType.ExtTypeEthCompatAddress, value: strip0x(token) },
                        // The address on the Ethereum blockchain to which BTC will be transferred
                        { name: "to" as const, type: RenVMType.ExtTypeEthCompatAddress, value: strip0x(to) },
                        // The nonce is used to randomize the gateway
                        { name: "n" as const, type: RenVMType.TypeB32, value: toBase64(nonce) },

                        // UTXO
                        {
                            name: "utxo" as const,
                            type: RenVMType.ExtTypeBtcCompatUTXO,
                            value: {
                                txHash: toBase64(utxoTxHash),
                                vOut: utxoVout,
                            }
                        },
                    ],
                }
            });

        return response.tx.hash;
    }

    public submitBurn = async (renContract: RenContract, ref: string): Promise<string> => {
        const response = await this.provider.sendMessage(RPCMethod.MethodSubmitTx,
            {
                tx: {
                    to: renContract,
                    in: [
                        { name: "ref", type: RenVMType.TypeU64, value: ref },
                    ],
                }
            });

        return response.tx.hash;
    }

    public readonly queryMintOrBurn = async <T extends ResponseQueryMintTx | ResponseQueryBurnTx>(utxoTxHash: string): Promise<T> => {
        return await this.provider.sendMessage(
            RPCMethod.MethodQueryTx,
            {
                txHash: toBase64(utxoTxHash),
            },
        ) as T;
    }

    public readonly waitForTX = async <T extends ResponseQueryMintTx | ResponseQueryBurnTx>(
        utxoTxHash: string,
        onStatus?: (status: TxStatus) => void,
        _cancelRequested?: () => boolean,
    ): Promise<T> => {
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
                if (String((error || {}).message).match(/(not found)|(not available)/)) {
                    // ignore
                } else {
                    // tslint:disable-next-line: no-console
                    console.error(String(error));
                    // TODO: throw unepected errors
                }
            }
            await sleep(5 * SECONDS);
        }
        return rawResponse;
    }

    /**
     * selectPublicKey fetches the public key for the RenVM shard handling
     * the provided contract.
     *
     * @param {RenContract} renContract The Ren Contract for which the public
     *        key should be fetched.
     * @returns The public key hash (20 bytes) as a string.
     */
    public readonly selectPublicKey = async (renContract: RenContract): Promise<Buffer> => {

        // Call the ren_queryShards RPC.
        const response = await this.queryShards(5);

        // Filter to only keep shards that are primary/online.
        const primaryShards = response.shards.filter(shard => shard.primary);

        // Find the shard with the lowest total value locked (sum all the locked
        // amounts from all gateways in a shard, after converting to a consistent
        // currencies using the coinGecko API).
        const tokens = Set<string>().concat(
            ...primaryShards.map(shard => shard.gateways.map(gateway => gateway.asset))
        ).toArray();
        const tokenPrices: TokenPrices = await getTokenPrices(tokens)
            .catch(() => OrderedMap());
        const token: Asset = parseRenContract(renContract).asset;

        const smallestShard = List(primaryShards)
            .filter(shard => shard.gateways.map(gateway => gateway.asset).includes(token))
            .sortBy(shard => shard.gateways
                .map(gateway => normalizeValue(tokenPrices, gateway.asset, gateway.locked))
                .reduce((sum, value) => sum.plus(value), new BigNumber(0)).toNumber())
            .first(undefined);

        if (!smallestShard) {
            throw new Error("Unable to load public key from RenVM: no shards found");
        }

        // Get the gateway pubKey from the gateway with the right asset within
        // the shard with the lowest total value locked.
        const tokenGateway = List(smallestShard.gateways).filter(gateway => gateway.asset === token).first(undefined);

        if (!tokenGateway) {
            throw new Error(`Unable to load public key from RenVM: no gateway for the asset ${token}`);
        }

        // Use this gateway pubKey to build the gateway address.
        return hash160(
            Buffer.from(tokenGateway.pubKey, "base64")
        );
    }
}
