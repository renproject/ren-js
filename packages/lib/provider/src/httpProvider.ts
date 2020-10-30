import { Logger } from "@renproject/interfaces";
import {
    assertType,
    extractError,
    retryNTimes,
    SECONDS,
} from "@renproject/utils";
import axios, { AxiosResponse } from "axios";

import { JSONRPCResponse, Provider } from "./jsonRPC";

const generatePayload = (method: string, params?: unknown) => ({
    id: 1,
    jsonrpc: "2.0",
    method,
    params,
});

export class HttpProvider<
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    Requests extends { [event: string]: any } = {},
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    Responses extends { [event: string]: any } = {}
> implements Provider<Requests, Responses> {
    public readonly nodeURL: string;
    public readonly logger: Logger | undefined;

    constructor(ipOrMultiaddress: string, logger?: Logger) {
        this.logger = logger;
        // Type validation
        assertType<string>("string", { ipOrMultiaddress });

        if (ipOrMultiaddress.charAt(0) === "/") {
            try {
                const [, , ip, , port, ,] = ipOrMultiaddress.split("/");
                const fixedPort = port === "18514" ? "18515" : port;
                // TODO: Use HTTPS if supported
                const protocol = "http";
                this.nodeURL = `${protocol}://${ip}:${fixedPort}`;
            } catch (error) {
                throw new Error(`Malformatted address: ${ipOrMultiaddress}`);
            }
        } else {
            if (ipOrMultiaddress.indexOf("://") === -1) {
                throw new Error(
                    `Invalid node URL without protocol: ${ipOrMultiaddress}.`,
                );
            }
            this.nodeURL = ipOrMultiaddress;
        }
        if (!this.nodeURL) {
            throw new Error("Invalid empty node URL.");
        }
    }

    public sendMessage = async <Method extends keyof Requests & string>(
        method: Method,
        request: Requests[Method],
        retry = 2,
        timeout = 120 * SECONDS,
    ): Promise<Responses[Method]> => {
        // Promise<Responses[Method]> {
        // Print request:
        if (this.logger) {
            this.logger.debug(
                "[request]",
                JSON.stringify(generatePayload(method, request), null, "    "),
            );
        }
        try {
            const response = await retryNTimes(
                async () =>
                    axios.post<JSONRPCResponse<Responses[Method]>>(
                        this.nodeURL,
                        generatePayload(method, request),
                        // Use a 120 second timeout. This could be reduced, but
                        // should be done based on the method, since some requests
                        // may take a long time, especially on a slow connection.
                        { timeout },
                    ),
                retry,
            );
            if (response.status !== 200) {
                throw this.responseError(
                    "Unexpected status code returned from node",
                    response,
                );
            }
            if (response.data.error) {
                throw new Error(response.data.error);
            }
            if (response.data.result === undefined) {
                throw new Error(`Empty result returned from node`);
            }
            if (this.logger) {
                this.logger.debug(
                    "[response]",
                    JSON.stringify(response.data.result, null, "    "),
                );
            }
            return response.data.result;
        } catch (error) {
            if (error.response) {
                error.message = `Node returned status ${String(
                    error.response.status,
                )} with reason: ${extractError(error)}`;
            }
            throw error;
        }
    };

    private readonly responseError = (
        msg: string,
        response: AxiosResponse,
    ): ResponseError => {
        const error = new Error(msg) as ResponseError;
        error.response = response;
        return error;
    };
}

interface ResponseError extends Error {
    response: AxiosResponse;
}
