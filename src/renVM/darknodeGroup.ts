import { List, OrderedSet } from "immutable";

import { Darknode } from "./darknode";
import {
    ParamsQueryBlock, ParamsQueryBlocks, ParamsQueryEpoch, ParamsQueryTx, ParamsSubmitBurn,
    ParamsSubmitMint, RPCMethod, RPCParams, RPCResponse,
} from "./jsonRPC";

const promiseAll = async <a>(list: List<Promise<a>>, defaultValue: a): Promise<[List<a>, OrderedSet<string>]> => {
    let errors = OrderedSet<string>();
    let newList = List<a>();
    for (const entryP of list.toArray()) {
        try {
            newList = newList.push(await entryP);
        } catch (error) {
            const errorString = String(error);
            if (!errors.has(errorString)) {
                errors = errors.add(errorString);
                // tslint:disable-next-line: no-console
                console.error(errorString);
            }
            newList = newList.push(defaultValue);
        }
    }
    return [newList, errors];
};

export class DarknodeGroup {
    public nodes: List<Darknode>;

    constructor(nodeURLs: string[]) {
        this.nodes = List(nodeURLs.map(nodeURL => new Darknode(nodeURL)));
    }

    public sendMessage = async <Method extends RPCMethod>(method: Method, request: RPCParams<Method>, retry = 1): Promise<RPCResponse<Method>> => {
        // tslint:disable-next-line: prefer-const
        let [responses, errors] = await promiseAll(
            this.nodes.valueSeq().map(
                async (node) => node.sendMessage<Method>(
                    method,
                    request,
                    retry,
                ),
            ).toList(),
            null,
        );
        responses = responses.filter((result) => result !== null);

        const first = responses.first(null);
        if (first === null) {
            if (errors.size) {
                throw new Error(errors.first());
            } else {
                throw new Error(`No response from RenVM while submitting message`);
            }
        }

        return first;
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
