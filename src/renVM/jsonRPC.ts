import { Ox } from "../lib/utils";

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
    name: name;
    type: type;
    value: valueType; // "8d8126"
}

// tslint:disable-next-line: no-any
export type Args = Array<Arg<string, string, any>>;

// tslint:disable-next-line: no-any
export const decodeValue = <Name extends string, Type extends string, Value>(value: Arg<Name, Type, Value>) => {
    try {
        // ext_btcCompatUTXO
        if (value.type === "ext_btcCompatUTXO" || value.type === "ext_zecCompatUTXO") {
            return value.value;
        }

        // u32, u64, etc.
        if (value.type.match(/u[0-9]+/)) {
            return value.value;
        }

        // b, b20, b32, etc.
        if (value.type.match(/b[0-9]+/)) {
            return Ox(Buffer.from(value.value as unknown as string, "base64"));
        }

        // Fallback
        return Ox(Buffer.from(value.value as unknown as string, "base64"));
    } catch (error) {
        throw new Error(`Unable to unmarshal ${value.name} of type ${value.type} from RenVM: ${JSON.stringify(value.value)} - ${error}`);
    }
};
