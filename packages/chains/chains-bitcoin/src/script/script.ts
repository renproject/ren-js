import { sha256 } from "@renproject/utils";

import { hash160 } from "../utils/utils";
import { Opcode } from "./opcodes";

const checksum = (hash: Buffer) => sha256(sha256(hash)).slice(0, 4);

export class Script {
    private script: Buffer;

    static OP = Opcode;
    public OP = Opcode;

    constructor() {
        this.script = Buffer.from([]);
    }

    addOp = (op: Opcode) => {
        this.script = Buffer.concat([this.script, Buffer.from([op])]);
        return this;
    };

    addData = (data: Buffer) => {
        this.script = Buffer.concat([
            this.script,
            Buffer.from([data.length]),
            data,
        ]);
        return this;
    };

    toBuffer = () => this.script;

    toScriptHashOut = (): Buffer =>
        new Script()
            .addOp(Script.OP.OP_HASH160)
            .addData(hash160(this.toBuffer()))
            .addOp(Script.OP.OP_EQUAL)
            .toBuffer();

    toAddress = (prefix: Buffer): Buffer => {
        // Hash
        const hash = hash160(this.toBuffer());

        // Prepend prefix
        const hashWithPrefix = Buffer.concat([prefix, hash]);

        // Append checksum
        const hashWithChecksum = Buffer.concat([
            hashWithPrefix,
            checksum(hashWithPrefix),
        ]);

        return hashWithChecksum;
    };
}
