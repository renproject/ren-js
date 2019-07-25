import axios, { AxiosResponse } from "axios";

import { retryNTimes } from "../lib/utils";
import { JSONRPCResponse } from "./jsonRPC";

export enum RPCMethod {
    SubmitTx = "ren_submitTx",
    QueryTx = "ren_queryTx",
}

export const generatePayload = (method: string, params?: unknown) => ({
    id: 1,
    jsonrpc: "2.0",
    method,
    params,
});

export class RenNode {
    public readonly nodeURL: string;

    constructor(lightnodeURL: string) {
        if (lightnodeURL.charAt(0) === "/") {
            try {
                // tslint:disable-next-line: whitespace
                const [, , ip, , port, ,] = lightnodeURL.split("/");
                const fixedPort = port === "18514" ? "18515" : port;
                // TODO: Use HTTPS if supported
                const protocol = "http";
                this.nodeURL = `${protocol}://${ip}:${fixedPort}`;
            } catch (error) {
                throw new Error(`Malformatted address: ${lightnodeURL}`);
            }
        } else {
            this.nodeURL = lightnodeURL;
        }
    }

    public async sendMessage<Request, Response>(method: RPCMethod, request: Request): Promise<JSONRPCResponse<Response>> {
        let resp;
        try {
            resp = await retryNTimes(
                () => axios.post(
                    this.nodeURL,
                    generatePayload(method, request),
                    { timeout: 120000 }),
                5,
            );
            if (resp.status !== 200) {
                throw this.responseError("Unexpected status code returned by Lightnode", resp);
            }
        } catch (error) {
            if (error.response) {
                error.message = `Lightnode returned status ${error.response.status} with reason: ${error.response.data}`;
            }
            throw error;
        }
        return resp.data as JSONRPCResponse<Response>;
    }

    private responseError(msg: string, response: AxiosResponse): ResponseError {
        const error = new Error(msg) as ResponseError;
        error.response = response;
        return error;
    }
}

interface ResponseError extends Error {
    response: AxiosResponse;
}
