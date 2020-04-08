import { Provider } from "@renproject/provider";

import {
    ParamsQueryBlock, ParamsQueryBlocks, ParamsQueryEpoch, ParamsQueryTx, ParamsSubmitBurn,
    ParamsSubmitMint, RenVMParams, RenVMResponses, RPCMethod,
} from "./renVMTypes";

export * from "./renVMTypes";
export * from "./transaction";

export class RenVMProvider implements Provider<RenVMParams, RenVMResponses> {
    public readonly provider: Provider<RenVMParams, RenVMResponses>;
    sendMessage: RenVMProvider["provider"]["sendMessage"];

    constructor(provider: Provider<RenVMParams, RenVMResponses>) {
        this.provider = provider;
        this.sendMessage = this.provider.sendMessage;
    }

    public queryBlock = async (blockHeight: ParamsQueryBlock["blockHeight"], retry?: number) =>
        this.sendMessage<RPCMethod.QueryBlock>(RPCMethod.QueryBlock, { blockHeight }, retry)

    public queryBlocks = async (blockHeight: ParamsQueryBlocks["blockHeight"], n: ParamsQueryBlocks["n"], retry?: number) =>
        this.sendMessage<RPCMethod.QueryBlocks>(RPCMethod.QueryBlocks, { blockHeight, n }, retry)

    public submitTx = async (tx: ParamsSubmitBurn["tx"] | ParamsSubmitMint["tx"], retry?: number) =>
        // tslint:disable-next-line: no-object-literal-type-assertion
        this.sendMessage<RPCMethod.SubmitTx>(RPCMethod.SubmitTx, { tx } as ParamsSubmitBurn | ParamsSubmitMint, retry)

    public queryTx = async (txHash: ParamsQueryTx["txHash"], retry?: number) =>
        this.sendMessage<RPCMethod.QueryTx>(RPCMethod.QueryTx, { txHash }, retry)

    public queryNumPeers = async (retry?: number) =>
        this.sendMessage<RPCMethod.QueryNumPeers>(RPCMethod.QueryNumPeers, {}, retry)

    public queryPeers = async (retry?: number) =>
        this.sendMessage<RPCMethod.QueryPeers>(RPCMethod.QueryPeers, {}, retry)

    public queryEpoch = async (epochHash: ParamsQueryEpoch["epochHash"], retry?: number) =>
        this.sendMessage<RPCMethod.QueryEpoch>(RPCMethod.QueryEpoch, { epochHash }, retry)

    public queryStat = async (retry?: number) =>
        this.sendMessage<RPCMethod.QueryStat>(RPCMethod.QueryStat, {}, retry)
}
