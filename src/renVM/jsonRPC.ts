import { Ox } from "../blockchain/common";

export type JSONRPCResponse<T> = {
    jsonrpc: string;
    version: string;
    result: T;
    error: undefined;
    id: number;
} | {
    jsonrpc: string;
    version: string;
    result: undefined;
    // tslint:disable-next-line: no-any
    error: any;
    id: number;
};

export interface Arg<name extends string, type extends string, valueType> {
    type: type;
    name: name;
    value: valueType; // "8d8126"
}

// tslint:disable-next-line: no-any
export type Args = Array<Arg<string, string, any>>;

// tslint:disable-next-line: no-any
export const decodeValue = (value: Arg<string, string, any>) => {
    try {
        return value.type.match(/u[0-9]+/) ? value.value : Ox(Buffer.from(value.value, "base64"));
    } catch (error) {
        throw new Error(`Unable to unmarshal value from RenVM: ${JSON.stringify(value)} - ${error}`);
    }
};
