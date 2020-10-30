import { LockChain, MintChain } from "@renproject/interfaces";
import { fromHex } from "@renproject/utils";
import BigNumber from "bignumber.js";

const confirmationRegistry: number[] = [];
const getConfs = (id: number) => {
    return confirmationRegistry[id];
};

export const buildMockLockChain = (conf = { targetConfirmations: 500 }) => {
    const id = confirmationRegistry.length;
    confirmationRegistry[id] = 0;
    const transactionConfidence = () => {
        return {
            current: getConfs(id),
            target: conf.targetConfirmations,
        };
    };

    const mockLockChain: LockChain = {
        name: "mockLockChain",
        assetDecimals: () => 1,
        addressIsValid: () => true,
        transactionID: () =>
            "0xb5252f4b08fda457234a6da6fd77c3b23adf8b3f4e020615b876b28aa7ee6299",
        transactionConfidence,
        initialize: () => {
            return mockLockChain;
        },
        getDeposits: async (_a, _b, _c, onDeposit) => {
            onDeposit({ transaction: {}, amount: "1" });
        },
        getGatewayAddress: () => "gatGatewayAddress",
        getPubKeyScript: () => Buffer.from("pubkey"),
        depositV1HashString: () => "v1HashString",
        legacyName: "Btc",
        assetIsNative: () => true,
        transactionRPCFormat: () => ({
            txid: fromHex(
                "0xb5252f4b08fda457234a6da6fd77c3b23adf8b3f4e020615b876b28aa7ee6299",
            ),
            txindex: "0",
        }),
        addressStringToBytes: (address: string): Buffer => Buffer.from(address),
    };
    return {
        mockLockChain,
        setConfirmations: (n: number) => {
            confirmationRegistry[id] = n;
        },
    };
};

export const buildMockMintChain = () => {
    const state = {
        currentLockConfs: 0,
    };
    const mockMintChain: MintChain = {
        name: "mockMintChain",
        assetDecimals: () => 1,
        addressIsValid: () => true,
        transactionID: () => "tid" + new Date().getTime(),
        // transactionID: () =>
        //     "0xb5252f4b08fda457234a6da6fd77c3b23adf8b3f4e020615b876b28aa7ee6299",
        transactionConfidence: () => ({ current: 0, target: 1 }),
        initialize: () => {
            return mockMintChain;
        },
        transactionRPCFormat: () => ({
            txid: fromHex(
                "0xb5252f4b08fda457234a6da6fd77c3b23adf8b3f4e020615b876b28aa7ee6299",
            ),
            txindex: "0",
        }),
        legacyName: "Eth",
        resolveTokenGatewayContract: async () =>
            "0x0000000000000000000000000000000000000000",
        submitMint: (_asset, _calls, _tx, emitter) => {
            setTimeout(() => {
                emitter.emit(
                    "transactionHash",
                    "0xb5252f4b08fda457234a6da6fd77c3b23adf8b3f4e020615b876b28aa7ee6299",
                );
            }, 100);
        },
        findBurnTransaction: (_p, _d, emitter) => {
            setTimeout(() => {
                emitter.emit(
                    "transactionHash",
                    "0xb5252f4b08fda457234a6da6fd77c3b23adf8b3f4e020615b876b28aa7ee6299",
                );
            }, 1000);

            return {
                transaction: {
                    hash:
                        "0xb5252f4b08fda457234a6da6fd77c3b23adf8b3f4e020615b876b28aa7ee6299",
                },
                amount: new BigNumber(0),
                to: "asd",
                nonce: new BigNumber(0),
            };
        },
        findTransaction: () => "mintTxHash",
        contractCalls: async () => [
            {
                sendTo: "0x0000000000000000000000000000000000000000",
                contractFn: "nop",
            },
        ],
    };
    return { mockMintChain, state };
};