/**
 * EncodedData is a wrapper type that can contain and format bytes in various
 * encodings (hex, base64, base58, node's buffer).
 *
 * Usage:
 *
 * new EncodedData("0x1234")
 * new EncodedData("1234", Encodings.HEX)
 *
 * new EncodedData(buffer).toBase58()
 *
 */

// import * as bs58 from "bs58";

import { Record } from "./record";

const ErrorInvalidBuffer = "invalid buffer";
const ErrorInvalidHex = "invalid hex";
const ErrorUnableToConvertToHexadecimalRepresentation =
    "Unable to convert to hexadecimal representation";
const ErrorUnableToConvertToBase64Representation =
    "Unable to convert to base64 representation";
const ErrorUnableToConvertToBuffer = "Unable to convert to buffer";

export enum Encodings {
    AUTO = "auto",
    HEX = "hex",
    BASE64 = "base64",
    BUFFER = "buffer",
    UNKNOWN = "unknown",
}

const DefaultEncodedData = {
    value: "" as string | Buffer,
    encoding: Encodings.AUTO,
};

const parse = (
    param: string | Buffer | typeof DefaultEncodedData,
    encoding?: Encodings,
) => {
    if (encoding !== undefined) {
        if (typeof param === "string" && encoding !== Encodings.BUFFER) {
            param = {
                value: param,
                encoding,
            };
        } else if (param instanceof Buffer && encoding === Encodings.BUFFER) {
            param = {
                value: param,
                encoding,
            };
        }
    }

    if (typeof param === "string") {
        param = {
            value: param,
            encoding: Encodings.AUTO,
        };
    }
    if (param instanceof Buffer) {
        param = {
            value: param,
            encoding: Encodings.BUFFER,
        };
    }
    if (param.encoding === Encodings.AUTO) {
        if (typeof param.value === "string") {
            if (
                param.value === "" ||
                param.value.slice(0, 2) === "0x" ||
                param.value.match("^[A-Fa-f0-9]+$")
            ) {
                param.encoding = Encodings.HEX;
            } else if (param.value.match("^[A-Za-z0-9+/=]+$")) {
                param.encoding = Encodings.BASE64;
            }
        } else if (param.value instanceof Buffer) {
            param.encoding = Encodings.BUFFER;
        }
    }

    if (
        param.encoding === Encodings.BUFFER &&
        !(param.value instanceof Buffer)
    ) {
        throw new Error(ErrorInvalidBuffer);
    }

    if (param.encoding === Encodings.HEX) {
        if (typeof param.value !== "string") {
            throw new Error(ErrorInvalidHex);
        }

        if (param.value.slice(0, 2) === "0x") {
            param.value = param.value.slice(2);
        }
        if (param.value === "") {
            param.value = "00";
        }

        if (param.value.length % 2 === 1) {
            param.value = "0" + param.value;
        }

        if (!param.value.match("^[A-Fa-f0-9]+$")) {
            throw new Error(ErrorInvalidHex);
        }
    }

    return param;
};

export class EncodedData extends Record(DefaultEncodedData) {
    /**
     * Creates an instance of EncodedData.
     * @param {string | Buffer} param The encoded data
     * @param {Encodings} [encoding] One of "hex", "base64", "buffer"
     * @memberof EncodedData
     */
    constructor(
        param: EncodedData | string | Buffer | typeof DefaultEncodedData,
        encoding?: Encodings,
    ) {
        if (param instanceof EncodedData) {
            param = { value: param.value, encoding: param.encoding };
        }
        param = parse(param, encoding);
        super(param);
    }

    public toHex(this: EncodedData, prefix = "0x"): string {
        switch (this.encoding) {
            case Encodings.HEX:
                return prefix + this.value;
            case Encodings.BASE64:
                return (
                    prefix +
                    Buffer.from(this.value as string, "base64").toString("hex")
                );
            case Encodings.BUFFER:
                return prefix + (this.value as Buffer).toString("hex");
            default:
                throw new Error(
                    ErrorUnableToConvertToHexadecimalRepresentation,
                );
        }
    }

    public toBase64(this: EncodedData): string {
        switch (this.encoding) {
            case Encodings.HEX:
                return Buffer.from(this.value as string, "hex").toString(
                    "base64",
                );
            case Encodings.BASE64:
                return this.value as string;
            case Encodings.BUFFER:
                return (this.value as Buffer).toString("base64");
            default:
                throw new Error(ErrorUnableToConvertToBase64Representation);
        }
    }

    // public toBase58(this: EncodedData): string {
    //     const buff = this.toBuffer();
    //     return bs58.encode(buff);
    // }

    public toBuffer(this: EncodedData): Buffer {
        switch (this.encoding) {
            case Encodings.HEX:
                return Buffer.from(this.value as string, "hex");
            case Encodings.BASE64:
                return Buffer.from(this.value as string, "base64");
            case Encodings.BUFFER:
                return this.value as Buffer;
            default:
                throw new Error(ErrorUnableToConvertToBuffer);
        }
    }

    public toString(this: EncodedData): string {
        return this.toHex();
    }

    public toNumber(this: EncodedData): number {
        return parseInt(this.toHex(), 16);
    }
}
