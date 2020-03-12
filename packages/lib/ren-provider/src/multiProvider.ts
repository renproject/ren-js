import { List, OrderedSet } from "immutable";

import { HttpProvider } from "./httpProvider";

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

export class MultiProvider {
    public nodes: List<HttpProvider>;

    constructor(nodeURLs: string[]) {
        this.nodes = List(nodeURLs.map(nodeURL => new HttpProvider(nodeURL)));
    }

    public sendMessage = async <Method extends string, Request, Response>(method: Method, request: Request, retry = 1): Promise<Response> => {
        // tslint:disable-next-line: prefer-const
        let [responses, errors] = await promiseAll(
            this.nodes.valueSeq().map(
                async (node) => node.sendMessage<Method, Request, Response>(
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
}
