
export const sleep = async (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export const randomBytes = (bytes: number) => {
    const uints = new Uint32Array(bytes / 4); // 4 bytes (32 bits)
    window.crypto.getRandomValues(uints);
    let str = "";
    for (const uint of uints) {
        str += "0".repeat(8 - uint.toString(16).length) + uint.toString(16);
    }
    return "0x" + str;
};

export const randomNonce = () => randomBytes(32);
