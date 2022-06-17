import { utils } from "@renproject/utils";

import { hash160 } from "../utils/utils";
import { Opcode } from "./opcodes";

const checksum = (hash: Uint8Array) =>
    utils.sha256(utils.sha256(hash)).slice(0, 4);

export class Script {
    private script: Uint8Array;

    public static OP = Opcode;
    public OP = Opcode;

    public constructor() {
        this.script = new Uint8Array();
    }

    public addOp = (op: Opcode): this => {
        this.script = new Uint8Array([...this.script, op]);
        return this;
    };

    public addData = (data: Uint8Array): this => {
        this.script = new Uint8Array([...this.script, data.length, ...data]);
        return this;
    };

    public bytes = (): Uint8Array => {
        return this.script;
    };

    public toScriptHashOut = (): Uint8Array => {
        return new Script()
            .addOp(Script.OP.OP_HASH160)
            .addData(hash160(this.bytes()))
            .addOp(Script.OP.OP_EQUAL)
            .bytes();
    };

    public toAddress = (prefix: Uint8Array | Uint8Array): Uint8Array => {
        // Hash
        const hash = hash160(this.bytes());

        // Prepend prefix
        const hashWithPrefix = utils.concat([prefix, hash]);

        // Append checksum
        const hashWithChecksum = utils.concat([
            hashWithPrefix,
            checksum(hashWithPrefix),
        ]);

        return hashWithChecksum;
    };
}
