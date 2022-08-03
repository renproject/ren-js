import BigNumber from "bignumber.js";
import chai, { expect } from "chai";
import chaiAsPromised from "chai-as-promised";

import { utils } from "../src/internal";

chai.use(chaiAsPromised);

describe("common utils", () => {
    context("sleep", () => {
        it("correct amount of time passes", async () => {
            const timeBefore = Date.now();
            await utils.sleep(0.1 * utils.sleep.SECONDS);
            const timeAfter = Date.now();

            const difference = (timeAfter - timeBefore) / 1000;

            expect(difference >= 0.1).to.equal(true);
            expect(difference < 0.15).to.equal(true);
        });
    });

    context("strip0x", () => {
        it("removes '0x' prefix", () => {
            expect(utils.strip0x("0x1234")).to.equal("1234");
            expect(utils.strip0x("0x")).to.equal("");
            expect(utils.strip0x("0x12345")).to.equal("12345");
            expect(utils.strip0x("1234")).to.equal("1234");
            expect(utils.strip0x("")).to.equal("");
        });
    });

    context("Ox", () => {
        it("appends Ox prefix", () => {
            expect(utils.Ox("1234")).to.equal("0x1234");
            expect(utils.Ox("")).to.equal("0x");
            expect(utils.Ox("0x1234")).to.equal("0x1234");
            expect(utils.Ox(utils.fromHex("1234"))).to.equal("0x1234");
        });
    });

    context("fromHex", () => {
        it("converts hex string to Buffer", () => {
            expect(utils.fromHex("1234")).to.deep.equal(
                new Uint8Array([0x12, 0x34]),
            );
            expect(utils.fromHex("0x1234")).to.deep.equal(
                new Uint8Array([0x12, 0x34]),
            );
            expect(
                utils.fromHex(utils.toHex(new Uint8Array([0x12, 0x34]))),
            ).to.deep.equal(new Uint8Array([0x12, 0x34]));
        });
    });

    context("fromBase64", () => {
        it("converts base64 string to Buffer", () => {
            expect(utils.fromBase64("EjQ=")).to.deep.equal(
                new Uint8Array([0x12, 0x34]),
            );
            expect(
                utils.fromBase64(utils.toBase64(new Uint8Array([0x12, 0x34]))),
            ).to.deep.equal(new Uint8Array([0x12, 0x34]));
        });

        it("converts url-base64 string to Buffer", () => {
            expect(utils.fromBase64("+/8=")).to.deep.equal(
                new Uint8Array([0xfb, 0xff]),
            );
            expect(utils.fromBase64("+/8")).to.deep.equal(
                new Uint8Array([0xfb, 0xff]),
            );
            expect(utils.fromBase64("-_8")).to.deep.equal(
                new Uint8Array([0xfb, 0xff]),
            );
            expect(utils.fromBase64("-_8=")).to.deep.equal(
                new Uint8Array([0xfb, 0xff]),
            );
        });
    });

    context("toBase64", () => {
        it("converts buffers to base64 strings", () => {
            expect(utils.toBase64(new Uint8Array([0xfb, 0xff]))).to.equal(
                "+/8=",
            );
        });
    });

    context("toURLBase64", () => {
        it("converts buffers to url-base64 strings", () => {
            expect(utils.toURLBase64(new Uint8Array([0xfb, 0xff]))).to.equal(
                "-_8",
            );
            // expect(toURLBase64("0xfbff")).to.equal("-_8");
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
                expect(utils.extractError(testcase)).to.equal("test");
            }
        });

        it("converts objects to JSON", () => {
            expect(utils.extractError({})).to.equal("{}");
            expect(utils.extractError(new BigNumber(1))).to.equal(`"1"`);
        });

        it("doesn't throw an error if it can't convert to JSON", () => {
            const a: { a?: unknown } = {};
            a.a = a;

            expect(utils.extractError(a)).to.equal("[object Object]");
        });
    });

    context("tryNTimes", () => {
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
            expect(await utils.tryNTimes(mustBeCalledNTimes(2), 2, 0)).to.equal(
                2,
            );
            expect(await utils.tryNTimes(mustBeCalledNTimes(1), 1, 0)).to.equal(
                1,
            );

            expect(
                await utils.tryNTimes(mustBeCalledNTimes(2), -1, 0),
            ).to.equal(2);

            let logged = false;
            const logger = {
                ...console,
                warn: () => {
                    logged = true;
                },
            };
            expect(
                await utils.tryNTimes(mustBeCalledNTimes(2), 2, 0, logger),
            ).to.equal(2);
            expect(logged).to.equal(true);

            await expect(
                utils.tryNTimes(mustBeCalledNTimes(2), 1, 0),
            ).to.be.rejectedWith("Only called 1/2 times");

            await expect(
                utils.tryNTimes(mustBeCalledNTimes(2, true), 1, 0),
            ).to.be.rejectedWith("Only called 1/2 times");
        });

        it("should use provided timeout", async () => {
            const timeout = 0.1 * 1000;
            const t1 = Date.now();
            expect(
                await utils.tryNTimes(mustBeCalledNTimes(2), 2, timeout),
            ).to.equal(2);
            const t2 = Date.now();
            // Should be greater than the timeout (allow for a small margin of
            // error).
            expect(t2 - t1).to.be.greaterThanOrEqual(timeout * 0.99);
        });
    });

    context("isDefined", () => {
        it("should correctly check if input is not null or undefined", () => {
            // Should only return false for these values.
            expect(utils.isDefined(null)).to.equal(false);
            expect(utils.isDefined(undefined)).to.equal(false);

            // Should return true for every other value.
            expect(utils.isDefined(true)).to.equal(true);
            expect(utils.isDefined(false)).to.equal(true);
            expect(utils.isDefined(0)).to.equal(true);
            expect(utils.isDefined({})).to.equal(true);
            expect(utils.isDefined("")).to.equal(true);
            expect(utils.isDefined(-1)).to.equal(true);
        });
    });

    context("toNBytes", () => {
        it("should correctly convert to bytes", () => {
            expect(
                utils.toHex(utils.toNBytes(new BigNumber(1000), 2, "be")),
            ).to.equal("03e8");
            expect(
                utils.toHex(utils.toNBytes(new BigNumber(1000), 2, "le")),
            ).to.equal("e803");
            expect(
                utils.toHex(utils.toNBytes(new BigNumber(1), 2, "be")),
            ).to.equal("0001");
            expect(
                utils.toHex(utils.toNBytes(new BigNumber(1), 2, "le")),
            ).to.equal("0100");
        });
    });

    context("toUTF8String", () => {
        it("should correctly convert to utf8-string", () => {
            expect(utils.toUTF8String(new Uint8Array([97, 98]))).to.equal("ab");
        });
    });

    context("fromUTF8String", () => {
        it("should correctly convert from utf8-string", () => {
            console.info(
                utils.fromUTF8String(
                    "terra18wgytl2ktjulm00l2km4g3e3z8aqnmy7829tf6",
                ),
            );
            expect(
                utils.toHex(utils.fromUTF8String("BTC/toEthereum")),
            ).to.equal("4254432f746f457468657265756d");
            expect(utils.fromUTF8String("!").join(",")).to.equal(
                new Uint8Array([33]).join(","),
            );
        });
    });
});
