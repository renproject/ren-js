import { List, OrderedSet } from "immutable";

import { Darknode } from "./darknode";
import { QueryPeers, QueryStat, RPCMethod } from "./jsonRPC";

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

    public sendMessage = async <Request, Response>(method: RPCMethod, args: Request): Promise<Response> => {
        // tslint:disable-next-line: prefer-const
        let [responses, errors] = await promiseAll(
            this.nodes.valueSeq().map(
                async (node) => node.sendMessage<Request, Response>(
                    method,
                    args,
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

    public queryStat = async () => this.sendMessage<{}, QueryStat>(RPCMethod.QueryStat, {});
    public queryPeers = async () => this.sendMessage<{}, QueryPeers>(RPCMethod.QueryPeers, {});
}
