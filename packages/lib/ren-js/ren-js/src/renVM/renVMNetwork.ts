import { List, OrderedSet } from "immutable";

import { JSONRPCResponse } from "./jsonRPC";
import { RenNode, RPCMethod } from "./renNode";

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

export class RenVMNetwork {
    public nodes: List<RenNode>;

    constructor(nodeURLs: string[]) {
        this.nodes = List(nodeURLs.map(nodeURL => new RenNode(nodeURL)));
    }

    public broadcastMessage = async <Request, Response>(method: RPCMethod, args: Request): Promise<JSONRPCResponse<Response>> => {
        // tslint:disable-next-line: prefer-const
        let [responses, errors] = await promiseAll(
            this.nodes.valueSeq().map(async (node) => {
                const response = await node.sendMessage<Request, Response>(
                    method,
                    args,
                );
                if (!response.result || response.error) {
                    throw new Error(response.error.message || response.error) || new Error(`Invalid message`);
                }
                return response;
            }).toList(),
            null
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
}
