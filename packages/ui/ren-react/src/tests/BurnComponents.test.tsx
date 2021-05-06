import "core-js/stable";
import "regenerator-runtime/runtime";

import React from "react";
import { render } from "@testing-library/react";
import { BasicBurn } from "../library/Components/BurnAndReleaseComponents";
import { BurnConfigSingle } from "../library";
import RenJS from "@renproject/ren";
import {
    buildMockLockChain,
    buildMockMintChain,
} from "@renproject/ren-tx/test/testutils/mock";
import BigNumber from "bignumber.js";

let parameters: BurnConfigSingle;
let mockLock = buildMockLockChain();
let mockMint = buildMockMintChain();

describe("Test Mint", () => {
    beforeEach(() => {
        jest.useFakeTimers();

        mockLock = buildMockLockChain();
        mockMint = buildMockMintChain();
        parameters = {
            sdk: new RenJS("testnet"),
            burnParams: {
                sourceAsset: "BTC",
                network: "testnet",
                destinationAddress: "na",
                targetAmount: "10000",
            },
            autoSubmit: true,
            from: mockMint.mockMintChain,
            to: mockLock.mockLockChain,
        };
    });
    afterEach(() => {
        jest.runOnlyPendingTimers();
        jest.useRealTimers();
    });

    const renderComponent = () => render(<BasicBurn parameters={parameters} />);

    it("should have correct className with default props", async () => {
        const { findByText } = renderComponent();
        const Burn = await findByText(/Creating Burn.*/, undefined, {
            timeout: 4900,
        });
        expect(Burn.textContent).toContain("Creating");
    });

    it("should prompt burn details", async () => {
        const { findByText } = renderComponent();
        const Burn = await findByText(/Burn.*/, undefined, {
            timeout: 4900,
        });
        expect(Burn.textContent).toContain("Burn");
    });

    it("should wait for wallet to sign", async () => {
        const { findByText } = renderComponent();
        const gatewayInfo = await findByText(
            /.*submit transaction in your wallet.*/,
            undefined,
            {
                timeout: 4900,
            },
        );
        expect(gatewayInfo.textContent).toContain("Please");
    });

    it("should fail to release an invalid burn", async () => {
        mockMint.mockMintChain.findBurnTransaction = (_p, _d, emitter) => {
            setTimeout(() => {
                emitter.emit(
                    "transactionHash",
                    "0xb5252f4b08fda457234a6da6fd77c3b23adf8b3f4e020615b876b28aa7ee6299",
                );
            }, 500);

            setInterval(() => {
                emitter.emit("confirmation", 1);
            }, 1000);

            return new Promise((resolve) => {
                setTimeout(() => {
                    resolve({
                        transaction: {
                            hash:
                                "0xb5252f4b08fda457234a6da6fd77c3b23adf8b3f4e020615b876b28aa7ee6299",
                        },
                        amount: new BigNumber(0),
                        to: "asd",
                        nonce: new BigNumber(0),
                    });
                }, 1100);
            });
        };
        const { findByText } = renderComponent();
        const gatewayInfo = await findByText(/Error Releasing.*/, undefined, {
            timeout: 4900,
        });
        expect(gatewayInfo.textContent).toContain("unknown");
    });
});
