import { Logger, NullLogger } from "@renproject/interfaces";

import { HttpProvider } from "./httpProvider";
import { Provider } from "./jsonRPC";

const parseDarknodeMultiaddress = (url: string) => {
    try {
        const [, , ip, , port, ,] = url.split("/");
        const fixedPort = port === "18514" ? "18515" : port;
        // TODO: Use HTTPS if supported
        const protocol = "http";
        return `${protocol}://${ip}:${fixedPort}`;
    } catch (error) {
        throw new Error(`Malformatted address: ${url}`);
    }
};

export class DarknodeProvider<
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        Requests extends { [event: string]: any } = {},
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        Responses extends { [event: string]: any } = {}
    >
    extends HttpProvider<Requests, Responses>
    implements Provider<Requests, Responses> {
    constructor(multiAddress: string, logger: Logger = NullLogger) {
        super(parseDarknodeMultiaddress(multiAddress), logger);
    }
}
