import BigNumber from "bignumber.js";
import { expect } from "chai";

import {
    extractError,
    fromBase64,
    fromBigNumber,
    fromHex,
    fromReadable,
    isDefined,
    Ox,
    randomBytes,
    randomNonce,
    rawEncode,
    retryNTimes,
    SECONDS,
    sleep,
    strip0x,
    toBase64,
    toReadable,
    toURLBase64,
} from "../src/common";

describe("common utils", () => {
    context("sleep", () => {
        it("correct amount of time passes", async () => {
            const timeBefore = Date.now();
            await sleep(0.1 * SECONDS);
            const timeAfter = Date.now();

            const difference = (timeAfter - timeBefore) / 1000;

            expect(difference >= 0.1).to.equal(true);
            expect(difference < 0.15).to.equal(true);
        });
    });

    context("strip0x", () => {
        it("removes '0x' prefix", () => {
            expect(strip0x("0x1234")).to.equal("1234");
            expect(strip0x("0x")).to.equal("");
            expect(strip0x("0x12345")).to.equal("12345");
            expect(strip0x("1234")).to.equal("1234");
            expect(strip0x("")).to.equal("");
        });
    });

    context("Ox", () => {
        it("appends Ox prefix", () => {
            expect(Ox("1234")).to.equal("0x1234");
            expect(Ox("")).to.equal("0x");
            expect(Ox("0x1234")).to.equal("0x1234");
            expect(Ox(Buffer.from("1234", "hex"))).to.equal("0x1234");
        });
    });

    context("fromHex", () => {
        it("converts hex string to Buffer", () => {
            expect(fromHex("1234")).to.equal(Buffer.from([0x12, 0x34]));
            expect(fromHex("0x1234")).to.equal(Buffer.from([0x12, 0x34]));
            expect(fromHex(Buffer.from([0x12, 0x34]))).to.equal(
                Buffer.from([0x12, 0x34]),
            );
        });
    });

    context("fromBase64", () => {
        it("converts base64 string to Buffer", () => {
            expect(fromBase64("EjQ=")).to.equal(Buffer.from([0x12, 0x34]));
            expect(fromBase64(Buffer.from([0x12, 0x34]))).to.equal(
                Buffer.from([0x12, 0x34]),
            );
        });

        it("converts url-base64 string to Buffer", () => {
            expect(fromBase64("+/8=")).to.equal(Buffer.from([0xfb, 0xff]));
            expect(fromBase64("+/8")).to.equal(Buffer.from([0xfb, 0xff]));
            expect(fromBase64("-_8")).to.equal(Buffer.from([0xfb, 0xff]));
            expect(fromBase64("-_8=")).to.equal(Buffer.from([0xfb, 0xff]));
        });
    });

    context("toBase64", () => {
        it("converts buffers to base64 strings", () => {
            expect(toBase64(Buffer.from([0xfb, 0xff]))).to.equal("+/8=");
        });
    });

    context("fromBigNumber", () => {
        it("converts BigNumbers to Buffers", () => {
            expect(fromBigNumber(new BigNumber(1))).to.equal(
                Buffer.from([0x01]),
            );
            expect(fromBigNumber(new BigNumber(11))).to.equal(
                Buffer.from([0x0b]),
            );
            expect(fromBigNumber(new BigNumber(16))).to.equal(
                Buffer.from([0x10]),
            );
            expect(fromBigNumber(new BigNumber(256))).to.equal(
                Buffer.from([0x01, 0x00]),
            );
        });
    });

    context("toURLBase64", () => {
        it("converts buffers to url-base64 strings", () => {
            expect(toURLBase64(Buffer.from([0xfb, 0xff]))).to.equal("-_8");
            // expect(toURLBase64("0xfbff")).to.equal("-_8");
        });
    });

    context("toReadable", () => {
        it("converts amounts from a sub-unit to the base unit", () => {
            expect(toReadable(10, 1).toNumber()).to.equal(1);
            expect(toReadable(10, 0).toNumber()).to.equal(10);
            expect(toReadable(10, 2).toNumber()).to.equal(0.1);
        });
    });

    context("fromReadable", () => {
        it("converts amounts from the base unit to a sub-unit", () => {
            expect(fromReadable(1, 1).toNumber()).to.equal(10);
            expect(fromReadable(10, 0).toNumber()).to.equal(10);
            expect(fromReadable(0.1, 2).toNumber()).to.equal(10);
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
                expect(extractError(testcase)).to.equal("test");
            }
        });

        it("converts objects to JSON", () => {
            expect(extractError({})).to.equal("{}");
            expect(extractError(new BigNumber(1))).to.equal(`"1"`);
        });

        it("doesn't throw an error if it can't convert to JSON", () => {
            const a: { a?: unknown } = {};
            a.a = a;

            expect(extractError(a)).to.equal("[object Object]");
        });
    });

    context("retryNTimes", () => {
        const mustBeCalledNTimes = (n: number, badError = false) => {
            let i = 0;
            // eslint-disable-next-line @typescript-eslint/require-await
            return async () => {
                i += 1;
                if (i < n) {
                    const error = new Error("Error.");
                    (
                        error as {
                            data?: string;
                        }
                    ).data = `Only called ${i}/${n} times`;
                    if (badError) {
                        (error as { message?: string }).message = undefined;
                    }
                    throw error;
                }
                return i;
            };
        };

        it("retries the correct number of times", async () => {
            expect(await retryNTimes(mustBeCalledNTimes(2), 2, 0)).to.equal(2);
            expect(await retryNTimes(mustBeCalledNTimes(1), 1, 0)).to.equal(1);

            expect(await retryNTimes(mustBeCalledNTimes(2), -1, 0)).to.equal(2);

            let logged = false;
            const logger = {
                ...console,
                warn: () => {
                    logged = true;
                },
            };
            expect(
                await retryNTimes(mustBeCalledNTimes(2), 2, 0, logger),
            ).to.equal(2);
            expect(logged).to.equal(true);

            await expect(
                retryNTimes(mustBeCalledNTimes(2), 1, 0),
            ).to.be.rejectedWith("Only called 1/2 times");

            await expect(
                retryNTimes(mustBeCalledNTimes(2, true), 1, 0),
            ).to.be.rejectedWith("Only called 1/2 times");
        });

        it("should use provided timeout", async () => {
            const timeout = 0.1 * 1000;
            const t1 = Date.now();
            expect(
                await retryNTimes(mustBeCalledNTimes(2), 2, timeout),
            ).to.equal(2);
            const t2 = Date.now();
            expect(t2 - t1).to.be.greaterThanOrEqual(timeout);
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
            expect(randomBytes(32).length).to.equal(32);
            expect(randomBytes(32)).not.to.equal(randomBytes(32));
            (global as { window: unknown }).window = {
                crypto: {
                    getRandomValues: (uints: Uint32Array) => {
                        for (let i = 0; i < uints.length; i++) {
                            uints[i] = 0;
                        }
                    },
                },
            };
            expect(randomBytes(32).length).to.equal(32);
        });
    });

    context("randomNonce", () => {
        it("should return a random 32-byte buffer", () => {
            expect(randomNonce().length).to.equal(32);
            expect(randomNonce()).not.to.equal(randomNonce());
        });
    });

    context("rawEncode", () => {
        it("should encode values passed in", () => {
            expect(rawEncode(["uint256"], [1])).to.equal(
                Buffer.from("00".repeat(31) + "01", "hex"),
            );
        });
    });

    context("isDefined", () => {
        it("should correctly check if input is not null or undefined", () => {
            // Should only return false for these values.
            expect(isDefined(null)).to.equal(false);
            expect(isDefined(undefined)).to.equal(false);

            // Should return true for every other value.
            expect(isDefined(true)).to.equal(true);
            expect(isDefined(false)).to.equal(true);
            expect(isDefined(0)).to.equal(true);
            expect(isDefined({})).to.equal(true);
            expect(isDefined("")).to.equal(true);
            expect(isDefined(-1)).to.equal(true);
        });
    });

    context("toHex", () => {});
});
