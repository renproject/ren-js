import BigNumber from "bignumber.js";
import { expect } from "earljs";

import {
    extractError,
    fromBase64,
    fromBigNumber,
    fromHex,
    Ox,
    randomBytes,
    randomNonce,
    rawEncode,
    retryNTimes,
    SECONDS,
    sleep,
    strip0x,
    toBase64,
    toURLBase64,
} from "../src/common";

describe("common utils", () => {
    context("sleep", () => {
        it("correct amount of time passes", async () => {
            const timeBefore = Date.now();
            await sleep(0.1 * SECONDS);
            const timeAfter = Date.now();

            const difference = (timeAfter - timeBefore) / 1000;

            expect(difference >= 0.1).toEqual(true);
            expect(difference < 0.11).toEqual(true);
        });
    });

    context("strip0x", () => {
        it("removes '0x' prefix", () => {
            expect(strip0x("0x1234")).toEqual("1234");
            expect(strip0x("0x")).toEqual("");
            expect(strip0x("0x12345")).toEqual("12345");
            expect(strip0x("1234")).toEqual("1234");
            expect(strip0x("")).toEqual("");
        });
    });

    context("Ox", () => {
        it("appends Ox prefix", () => {
            expect(Ox("1234")).toEqual("0x1234");
            expect(Ox("")).toEqual("0x");
            expect(Ox("0x1234")).toEqual("0x1234");
            expect(Ox(Buffer.from("1234", "hex"))).toEqual("0x1234");
        });
    });

    context("fromHex", () => {
        it("converts hex string to Buffer", () => {
            expect(fromHex("1234")).toEqual(Buffer.from([0x12, 0x34]));
            expect(fromHex("0x1234")).toEqual(Buffer.from([0x12, 0x34]));
            expect(fromHex(Buffer.from([0x12, 0x34]))).toEqual(
                Buffer.from([0x12, 0x34]),
            );
        });
    });

    context("fromBase64", () => {
        it("converts base64 string to Buffer", () => {
            expect(fromBase64("EjQ=")).toEqual(Buffer.from([0x12, 0x34]));
            expect(fromBase64(Buffer.from([0x12, 0x34]))).toEqual(
                Buffer.from([0x12, 0x34]),
            );
        });

        it("converts url-base64 string to Buffer", () => {
            expect(fromBase64("+/8=")).toEqual(Buffer.from([0xfb, 0xff]));
            expect(fromBase64("+/8")).toEqual(Buffer.from([0xfb, 0xff]));
            expect(fromBase64("-_8")).toEqual(Buffer.from([0xfb, 0xff]));
            expect(fromBase64("-_8=")).toEqual(Buffer.from([0xfb, 0xff]));
        });
    });

    context("toBase64", () => {
        it("converts buffers to base64 strings", () => {
            expect(toBase64(Buffer.from([0xfb, 0xff]))).toEqual("+/8=");
        });
    });

    context("fromBigNumber", () => {
        it("converts BigNumbers to Buffers", () => {
            expect(fromBigNumber(new BigNumber(1))).toEqual(
                Buffer.from([0x01]),
            );
            expect(fromBigNumber(new BigNumber(11))).toEqual(
                Buffer.from([0x0b]),
            );
            expect(fromBigNumber(new BigNumber(16))).toEqual(
                Buffer.from([0x10]),
            );
            expect(fromBigNumber(new BigNumber(256))).toEqual(
                Buffer.from([0x01, 0x00]),
            );
        });
    });

    context("toURLBase64", () => {
        it("converts buffers to url-base64 strings", () => {
            expect(toURLBase64(Buffer.from([0xfb, 0xff]))).toEqual("-_8");
            expect(toURLBase64("0xfbff")).toEqual("-_8");
        });
    });

    context("extractError", () => {
        it("should be able to extract errors from various objects", () => {
            const testcases = [
                "test",
                { error: "test" },
                { response: "test" },
                { data: "test" },
                { error: "test" },
                { context: "test" },
                { context: "test" },
                { message: "test" },
                { statusText: "test" },

                {
                    response: {
                        data: {
                            data: {
                                error: "test",
                            },
                        },
                    },
                },

                "Error: test",
            ];

            for (const testcase of testcases) {
                expect(extractError(testcase)).toEqual("test");
            }
        });

        it("converts objects to JSON", () => {
            expect(extractError({})).toEqual("{}");
            expect(extractError(new BigNumber(1))).toEqual(`"1"`);
        });

        it("doesn't throw an error if it can't convert to JSON", () => {
            const a: { a?: unknown } = {};
            a.a = a;

            expect(extractError(a)).toEqual("[object Object]");
        });
    });

    context("retryNTimes", () => {
        it("retries the correct number of times", async () => {
            const mustBeCalledNTimes = (n: number, badError = false) => {
                let i = 0;
                // eslint-disable-next-line @typescript-eslint/require-await
                return async () => {
                    i += 1;
                    if (i < n) {
                        const error = new Error("Error.");
                        (error as {
                            data?: string;
                        }).data = `Only called ${i}/${n} times`;
                        if (badError) {
                            (error as { message?: string }).message = undefined;
                        }
                        throw error;
                    }
                    return i;
                };
            };

            expect(await retryNTimes(mustBeCalledNTimes(2), 2)).toEqual(2);
            expect(await retryNTimes(mustBeCalledNTimes(1), 1)).toEqual(1);

            await expect(retryNTimes(mustBeCalledNTimes(2), 1)).toBeRejected(
                new Error("Error. (Only called 1/2 times)"),
            );

            await expect(
                retryNTimes(mustBeCalledNTimes(2, true), 1),
            ).toBeRejected(new Error("Only called 1/2 times"));
        });
    });

    context("randomBytes", () => {
        // Restore global window state afterwards incase this is being run in
        // a browser environment.
        let previousWindow: unknown;
        before(() => {
            previousWindow = (global as { window: unknown }).window;
        });
        after(() => {
            (global as { window: unknown }).window = previousWindow;
        });

        it("returns random bytes of the correct length", () => {
            expect(randomBytes(32).length).toEqual(32);
            expect(randomBytes(32)).not.toEqual(randomBytes(32));
            (global as { window: unknown }).window = {
                crypto: {
                    getRandomValues: (uints: Uint32Array) => {
                        for (let i = 0; i < uints.length; i++) {
                            uints[i] = 0;
                        }
                    },
                },
            };
            expect(randomBytes(32).length).toEqual(32);
        });
    });

    context("randomNonce", () => {
        it("should return a random 32-byte buffer", () => {
            expect(randomNonce().length).toEqual(32);
            expect(randomNonce()).not.toEqual(randomNonce());
        });
    });

    context("rawEncode", () => {
        it("should encode values passed in", () => {
            expect(rawEncode(["uint256"], [1])).toEqual(
                Buffer.from("00".repeat(31) + "01", "hex"),
            );
        });
    });
});
