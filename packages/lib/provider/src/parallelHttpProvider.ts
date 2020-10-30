import { Logger } from "@renproject/interfaces";
import { extractError } from "@renproject/utils";
import { List, OrderedSet } from "immutable";

import { HttpProvider } from "./httpProvider";
import { Provider } from "./jsonRPC";

const promiseAll = async <a>(
    list: List<Promise<a>>,
    defaultValue: a,
    logger?: Logger,
): Promise<[List<a>, OrderedSet<string>]> => {
    let errors = OrderedSet<string>();
    let newList = List<a>();
    for (const entryP of list.toArray()) {
        try {
            newList = newList.push(await entryP);
        } catch (error) {
            const errorString = extractError(error);
            if (!errors.has(errorString)) {
                errors = errors.add(errorString);
                if (logger) logger.error(errorString);
            }
            newList = newList.push(defaultValue);
        }
    }
    return [newList, errors];
};

export class ParallelHttpProvider<
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    Requests extends { [event: string]: any } = {},
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    Responses extends { [event: string]: any } = {}
> implements Provider<Requests, Responses> {
    public nodes: List<HttpProvider<Requests, Responses>>;
    private readonly logger: Logger | undefined;

    constructor(nodeURLs: string[], logger?: Logger) {
        this.logger = logger;
        this.nodes = List(
            nodeURLs.map(
                (nodeURL) =>
                    new HttpProvider<Requests, Responses>(nodeURL, logger),
            ),
        );
    }

    public sendMessage = async <Method extends keyof Requests & string>(
        method: Method,
        request: Requests[Method],
        retry = 2,
    ): Promise<Responses[Method]> => {
        // eslint-disable-next-line prefer-const
        let [responses, errors] = await promiseAll(
            this.nodes
                .valueSeq()
                .map(async (node) =>
                    node.sendMessage<Method>(method, request, retry),
                )
                .toList(),
            null,
            this.logger,
        );
        responses = responses.filter((result) => result !== null);

        const first = responses.first(null);
        if (first === null) {
            const error = errors.first()
                ? new Error(errors.first())
                : new Error(`No response from RenVM while submitting message`);
            if (this.logger) this.logger.debug(method, request, error.message);
            throw error;
        }

        if (this.logger) this.logger.debug(method, request, first);

        return first;
    };
}
