import createKeccakHash from "keccak";

export const keccak256 = (msg: Buffer): Buffer =>
    Buffer.from(createKeccakHash("keccak256").update(msg).digest());
