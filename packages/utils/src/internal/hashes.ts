import createHash from "create-hash";
import { keccak256 as jsKeccak256 } from "js-sha3";

import { assertType } from "./assert";

/**
 * Return the keccak256 hash of an array of buffers. The inputs are concatenated
 * before being hashed.
 */
export const keccak256 = (...msg: Buffer[]): Buffer => {
    assertType<Buffer[]>("Buffer[]", { msg });

    return Buffer.from(
        (jsKeccak256 as unknown as { buffer: typeof jsKeccak256 }).buffer(
            Buffer.concat(msg),
        ),
    );
};

export const sha256 = (...msg: Buffer[]): Buffer => {
    assertType<Buffer[]>("Buffer[]", { msg });
    return createHash("sha256").update(Buffer.concat(msg)).digest();
};
