import axios, { AxiosResponse } from "axios";

import {
    AddressesRequest, AddressesResponse, EpochResponse, HealthResponse, NumPeersResponse,
    PeersResponse, ReceiveMessageRequest, ReceiveMessageResponse, SendMessageRequest,
    SendMessageResponse,
} from "./types";

export class Lightnode {
    public readonly lightnodeURL: string;

    constructor(lightnode: string) {
        if (lightnode.charAt(0) === "/") {
            try {
                const [_, _ip4, ip, _tcp, port, _ren, _id] = lightnode.split("/");
                const fixedPort = port === "18514" ? "18514" : port;
                // tslint:disable-next-line: no-http-string
                this.lightnodeURL = `http://${ip}:${fixedPort}`;
            } catch (error) {
                throw new Error(`Malformatted address: ${lightnode}`);
            }
        } else {
            this.lightnodeURL = lightnode;
        }
    }

    public async getHealth(): Promise<HealthResponse> {
        let resp;
        try {
            resp = await axios.post(`${this.lightnodeURL}`, this.generatePayload("ren_healthCheck"));
            if (resp.status !== 200) {
                throw this.responseError("Unexpected status code returned by Darknode", resp);
            }
        } catch (error) {
            if (error.response) {
                throw new Error(
                    `Darknode returned status ${error.response.status} with reason: ${error.response.data}`,
                );
            } else {
                throw error;
            }
        }
        return resp.data as HealthResponse;
    }

    public async getPeers(): Promise<PeersResponse> {
        let resp;
        try {
            resp = await axios.post(`${this.lightnodeURL}`, this.generatePayload("ren_queryPeers"));
            if (resp.status !== 200) {
                throw this.responseError("Unexpected status code returned by Darknode", resp);
            }
        } catch (error) {
            if (error.response) {
                throw new Error(
                    `Darknode returned status ${error.response.status} with reason: ${error.response.data}`,
                );
            } else {
                throw error;
            }
        }
        return resp.data as PeersResponse;
    }

    public async getNumberOfPeers(): Promise<NumPeersResponse> {
        let resp;
        try {
            resp = await axios.post(`${this.lightnodeURL}`, this.generatePayload("ren_queryNumPeers"));
            if (resp.status !== 200) {
                throw this.responseError("Unexpected status code returned by Darknode", resp);
            }
        } catch (error) {
            if (error.response) {
                throw new Error(
                    `Darknode returned status ${error.response.status} with reason: ${error.response.data}`,
                );
            } else {
                throw error;
            }
        }
        return resp.data as NumPeersResponse;
    }

    public async getEpoch(): Promise<EpochResponse> {
        let resp;
        try {
            resp = await axios.post(`${this.lightnodeURL}`, this.generatePayload("ren_queryEpoch"));
            if (resp.status !== 200) {
                throw this.responseError("Unexpected status code returned by Darknode", resp);
            }
        } catch (error) {
            if (error.response) {
                throw new Error(
                    `Darknode returned status ${error.response.status} with reason: ${error.response.data}`,
                );
            } else {
                throw error;
            }
        }
        return resp.data as EpochResponse;
    }

    public async getAddresses(request: AddressesRequest): Promise<AddressesResponse> {
        let resp;
        try {
            resp = await axios.post(`${this.lightnodeURL}`, this.generatePayload("ren_queryAddresses", request));
            if (resp.status !== 200) {
                throw this.responseError("Unexpected status code returned by Darknode", resp);
            }
        } catch (error) {
            if (error.response) {
                throw new Error(
                    `Darknode returned status ${error.response.status} with reason: ${error.response.data}`,
                );
            } else {
                throw error;
            }
        }
        return resp.data as AddressesResponse;
    }

    public async sendMessage(request: SendMessageRequest): Promise<SendMessageResponse> {
        let resp;
        try {
            resp = await axios.post(`${this.lightnodeURL}`, this.generatePayload("ren_sendMessage", request));
            if (resp.status !== 200) {
                throw this.responseError("Unexpected status code returned by Darknode", resp);
            }
        } catch (error) {
            if (error.response) {
                throw new Error(
                    `Darknode returned status ${error.response.status} with reason: ${error.response.data}`,
                );
            } else {
                throw error;
            }
        }
        return resp.data as SendMessageResponse;
    }

    public async receiveMessage(request: ReceiveMessageRequest): Promise<ReceiveMessageResponse> {
        let resp;
        try {
            resp = await axios.post(`${this.lightnodeURL}`, this.generatePayload("ren_receiveMessage", request));
            if (resp.status !== 200) {
                throw this.responseError("Unexpected status code returned by Darknode", resp);
            }
        } catch (error) {
            if (error.response) {
                throw new Error(
                    `Darknode returned status ${error.response.status} with reason: ${error.response.data}`,
                );
            } else {
                throw error;
            }
        }
        return resp.data as ReceiveMessageResponse;
    }

    private generatePayload(method: string, params?: unknown) {
        return {
            id: 1,
            jsonrpc: "2.0",
            method,
            params,
            version: "0.0",
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
