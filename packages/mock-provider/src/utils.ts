import { utils } from "@renproject/utils";

/**
 * Generates a random hex string (prefixed with '0x').
 *
 * @param bytes The number of bytes to generate.
 */
export const randomBytes = (bytes: number): Uint8Array => {
    try {
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        if (window) {
            const uints = new Uint32Array(bytes / 4); // 4 bytes (32 bits)
            // eslint-disable-next-line @typescript-eslint/ban-ts-comment
            // @ts-ignore
            window.crypto.getRandomValues(uints);
            let str = "";
            for (const uint of uints) {
                str +=
                    "0".repeat(8 - uint.toString(16).length) +
                    String(uint.toString(16));
            }
            return utils.fromHex(str);
        }
    } catch (error: unknown) {
        // Ignore error
    }
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const crypto = require("crypto") as {
        randomBytes: (length: number) => Uint8Array;
    };
    return crypto.randomBytes(bytes);
};

// context("randomBytes", () => {
//     // Restore global window state afterwards incase this is being run in
//     // a browser environment.
//     let previousWindow: unknown;
//     before(() => {
//         previousWindow = (global as { window: unknown }).window;
//     });
//     after(() => {
//         (global as { window: unknown }).window = previousWindow;
//     });

//     it("returns random bytes of the correct length", () => {
//         expect(randomBytes(32).length).to.equal(32);
//         expect(randomBytes(32)).not.to.equal(randomBytes(32));
//         (global as { window: unknown }).window = {
//             crypto: {
//                 getRandomValues: (uints: Uint32Array) => {
//                     for (let i = 0; i < uints.length; i++) {
//                         uints[i] = 0;
//                     }
//                 },
//             },
//         };
//         expect(randomBytes(32).length).to.equal(32);
//     });
// });
