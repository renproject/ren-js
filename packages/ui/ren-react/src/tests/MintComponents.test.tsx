import "core-js/stable";
import "regenerator-runtime/runtime";

import React from "react";
import { render } from "@testing-library/react";
import { BasicMint } from "../library/Components/LockAndMintComponents";
import { MintConfigSingle } from "../library";
import RenJS from "@renproject/ren";
import {
    buildMockLockChain,
    buildMockMintChain,
} from "@renproject/ren-tx/test/testutils/mock";

let parameters: MintConfigSingle;
let mockLock = buildMockLockChain();
let mockMint = buildMockMintChain();

describe("Test Mint", () => {
    beforeEach(() => {
        jest.useFakeTimers();

        mockLock = buildMockLockChain();
        mockMint = buildMockMintChain();
        parameters = {
            sdk: new RenJS("testnet"),
            mintParams: {
                sourceAsset: "BTC",
                network: "testnet",
                destinationAddress: "na",
            },
            from: mockLock.mockLockChain,
            to: mockMint.mockMintChain,
        };
    });
    afterEach(() => {
        jest.runOnlyPendingTimers();
        jest.useRealTimers();
    });

    const renderComponent = () => render(<BasicMint parameters={parameters} />);

    it("should have correct className with default props", () => {
        renderComponent();
        const Mint = document.querySelector("div.gateway-opening");
        if (!Mint) {
            fail("Missing element");
        }
        expect(Mint.textContent).toContain("Opening");
    });

    it("should create a gateway address", async () => {
        const { findByText } = renderComponent();
        const gatewayInfo = await findByText(/Deposit.*/, undefined, {
            timeout: 4900,
        });
        expect(gatewayInfo.textContent).toContain("gatewayAddress");
    });

    it("should wait for confirmations", async () => {
        const { findByText } = renderComponent();
        const gatewayInfo = await findByText(/.*confirmation.*/, undefined, {
            timeout: 4900,
        });
        expect(gatewayInfo.textContent).toContain("/");
    });

    it("should submit once confirmed", async () => {
        const { findByText } = renderComponent();
        mockLock.setConfirmations(10);
        const gatewayInfo = await findByText(/Submitting.*/, undefined, {
            timeout: 4900,
        });
        expect(gatewayInfo.textContent).toContain("Submitting to RenVM...");
    });
});
