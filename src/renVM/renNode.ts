import axios, { AxiosResponse } from "axios";

import { retryNTimes } from "../lib/utils";
import { JSONRPCResponse } from "./jsonRPC";
import { QueryTxRequest, QueryTxResponse, SubmitTxRequest, SubmitTxResponse } from "./transaction";

export class RenNode {
    public readonly lightnodeURL: string;

    constructor(lightnodeURL: string) {
        if (lightnodeURL.charAt(0) === "/") {
            try {
                // tslint:disable-next-line: whitespace
                const [, , ip, , port, ,] = lightnodeURL.split("/");
                const fixedPort = port === "18514" ? "18514" : port;
                // TODO: Use HTTPS if supported
                const protocol = "http";
                this.lightnodeURL = `${protocol}://${ip}:${fixedPort}`;
            } catch (error) {
                throw new Error(`Malformatted address: ${lightnodeURL}`);
            }
        } else {
            this.lightnodeURL = lightnodeURL;
        }
    }

    public async submitTx(request: SubmitTxRequest): Promise<JSONRPCResponse<SubmitTxResponse>> {
        let resp;
        try {
            resp = await retryNTimes(
                () => axios.post(`${this.lightnodeURL}`, this.generatePayload("ren_submitTx", request), { timeout: 120000 }),
                5,
            );
            if (resp.status !== 200) {
                throw this.responseError("Unexpected status code returned by Lightnode", resp);
            }
        } catch (error) {
            if (error.response) {
                throw new Error(
                    `Lightnode returned status ${error.response.status} with reason: ${error.response.data}`,
                );
            } else {
                throw error;
            }
        }
        return resp.data as JSONRPCResponse<SubmitTxResponse>;
    }

    public async queryTx(request: QueryTxRequest): Promise<JSONRPCResponse<QueryTxResponse>> {
        let resp;
        try {
            resp = await retryNTimes(
                () => axios.post(`${this.lightnodeURL}`, this.generatePayload("ren_queryTx", request), { timeout: 120000 }),
                5
            );
            if (resp.status !== 200) {
                throw this.responseError("Unexpected status code returned by Lightnode", resp);
            }
        } catch (error) {
            if (error.response) {
                throw new Error(
                    `Lightnode returned status ${error.response.status} with reason: ${error.response.data}`,
                );
            } else {
                throw error;
            }
        }
        return resp.data as JSONRPCResponse<QueryTxResponse>;
    }

    private generatePayload(method: string, params?: unknown) {
        return {
            id: 1,
            jsonrpc: "2.0",
            method,
            params,
        };
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
