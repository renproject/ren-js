import { extractError, retryNTimes } from "@renproject/utils";
import axios, { AxiosResponse } from "axios";

import {
    JSONRPCResponse, ParamsQueryBlock, ParamsQueryBlocks, ParamsQueryEpoch, ParamsQueryTx,
    ParamsSubmitBurn, ParamsSubmitMint, RPCMethod, RPCParams, RPCResponse,
} from "./jsonRPC";

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
            if (ipOrMultiaddress.indexOf("://") === -1) {
                throw new Error(`Invalid node URL without protocol: ${ipOrMultiaddress}.`);
            }
            this.nodeURL = ipOrMultiaddress;
        }
        if (!this.nodeURL) {
            throw new Error("Invalid empty node URL.");
        }
    }

    public async sendMessage<Method extends RPCMethod>(method: Method, request: RPCParams<Method>, retry = 5): Promise<RPCResponse<Method>> {
        try {
            const response = await retryNTimes(
                () => axios.post<JSONRPCResponse<RPCResponse<Method>>>(
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

    private responseError(msg: string, response: AxiosResponse): ResponseError {
        const error = new Error(msg) as ResponseError;
        error.response = response;
        return error;
    }
}

interface ResponseError extends Error {
    response: AxiosResponse;
}
