import axios, { AxiosResponse } from "axios";

import { extractError, retryNTimes } from "../lib/utils";
import { JSONRPCResponse, QueryPeers, QueryStat, RPCMethod } from "./jsonRPC";

const generatePayload = (method: string, params?: unknown) => ({
    id: 1,
    jsonrpc: "2.0",
    method,
    params,
});

export class Darknode {
    public readonly nodeURL: string;

    constructor(ipOrMultiaddress: string) {
        if (ipOrMultiaddress.charAt(0) === "/") {
            try {
                const [, , ip, , port, ,] = ipOrMultiaddress.split("/"); // tslint:disable-line: whitespace
                const fixedPort = port === "18514" ? "18515" : port;
                // TODO: Use HTTPS if supported
                const protocol = "http";
                this.nodeURL = `${protocol}://${ip}:${fixedPort}`;
            } catch (error) {
                throw new Error(`Malformatted address: ${ipOrMultiaddress}`);
            }
        } else {
            this.nodeURL = ipOrMultiaddress;
        }
        if (!this.nodeURL) {
            throw new Error("Invalid node URL");
        }
    }

    public async sendMessage<Request, Response>(method: RPCMethod, request: Request, retry = 5): Promise<Response> {
        try {
            const response = await retryNTimes(
                () => axios.post<JSONRPCResponse<Response>>(
                    this.nodeURL,
                    generatePayload(method, request),
                    { timeout: 120000 }),
                retry,
            );
            if (response.status !== 200) {
                throw this.responseError("Unexpected status code returned from node", response);
            }
            if (response.data.error) {
                throw new Error(response.data.error);
            }
            if (response.data.result === undefined) {
                throw new Error(`Empty result returned from node`);
            }
            return response.data.result;
        } catch (error) {
            if (error.response) {
                error.message = `Node returned status ${error.response.status} with reason: ${extractError(error)}`;
            }
            throw error;
        }
    }

    public queryStat = async () => this.sendMessage<{}, QueryStat>(RPCMethod.QueryStat, {});
    public queryPeers = async () => this.sendMessage<{}, QueryPeers>(RPCMethod.QueryPeers, {});

    private responseError(msg: string, response: AxiosResponse): ResponseError {
        const error = new Error(msg) as ResponseError;
        error.response = response;
        return error;
    }
}

interface ResponseError extends Error {
    response: AxiosResponse;
}
