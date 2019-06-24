import axios, { AxiosResponse } from "axios";

import {
    ReceiveMessageRequest, ReceiveMessageResponse,
    SendMessageRequest, SendMessageResponse,
} from "./types";

export class Lightnode {
    public readonly lightnodeURL: string;

    constructor(lightnodeURL: string) {
        if (lightnodeURL.charAt(0) === "/") {
            try {
                const [_, _ip4, ip, _tcp, port, _ren, _id] = lightnodeURL.split("/");
                const fixedPort = port === "18514" ? "18514" : port;
                // tslint:disable-next-line: no-http-string
                this.lightnodeURL = `http://${ip}:${fixedPort}`;
            } catch (error) {
                throw new Error(`Malformatted address: ${lightnodeURL}`);
            }
        } else {
            this.lightnodeURL = lightnodeURL;
        }
    }

    public async sendMessage(request: SendMessageRequest): Promise<SendMessageResponse> {
        let resp;
        try {
            resp = await axios.post(`${this.lightnodeURL}`, this.generatePayload("ren_sendMessage", request));
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
        return resp.data as SendMessageResponse;
    }

    public async receiveMessage(request: ReceiveMessageRequest): Promise<ReceiveMessageResponse> {
        let resp;
        try {
            resp = await axios.post(`${this.lightnodeURL}`, this.generatePayload("ren_receiveMessage", request));
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
        return resp.data as ReceiveMessageResponse;
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
