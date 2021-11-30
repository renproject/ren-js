import { hash160, sha256 } from "../utils/utils";
import { Opcode } from "./opcodes";

const checksum = (hash: Buffer) => sha256(sha256(hash)).slice(0, 4);

export class Script {
    private script: Buffer;

    public static OP = Opcode;
    public OP = Opcode;

    public constructor() {
        this.script = Buffer.from([]);
    }

    public addOp(op: Opcode): this {
        this.script = Buffer.concat([this.script, Buffer.from([op])]);
        return this;
    }

    public addData(data: Buffer): this {
        this.script = Buffer.concat([
            this.script,
            Buffer.from([data.length]),
            data,
        ]);
        return this;
    }

    public toBuffer(): Buffer {
        return this.script;
    }

    public toScriptHashOut(): Buffer {
        return new Script()
            .addOp(Script.OP.OP_HASH160)
            .addData(hash160(this.toBuffer()))
            .addOp(Script.OP.OP_EQUAL)
            .toBuffer();
    }

    public toAddress(prefix: Buffer): Buffer {
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
    }
}
