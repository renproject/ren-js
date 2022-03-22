/* eslint-disable no-console */

import chai from "chai";
import { config as loadDotEnv } from "dotenv";
import { providers } from "ethers";

import { RenNetwork } from "@renproject/utils";

import { BinanceSmartChain } from "../build/main";
import { findABIMethod, LockGatewayABI } from "../src/contracts";
import { LogLockToChainEvent } from "../src/contracts/typechain/LockGatewayV3";
import { Ethereum } from "../src/ethereum";
import { getMintGateway } from "../src/utils/gatewayRegistry";
import {
    filterLogs,
    mapLockLogToInputChainTransaction,
} from "../src/utils/generic";

loadDotEnv();

chai.should();

describe("Logs", () => {
    it("LogLock", async () => {
        const network = RenNetwork.Testnet;
        const ethNetwork = Ethereum.configMap[network];

        const infuraURL = ethNetwork.network.rpcUrls[0];

        const provider = new providers.JsonRpcProvider(infuraURL);

        const txHash =
            "0x9c272d76e8067833c391af3e0cb5f3e23699db508216816c6a8288fdfbe243a1";
        const receipt = await provider.getTransactionReceipt(txHash);

        const logLockABI = findABIMethod(LockGatewayABI, "LogLockToChain");
        const lockDetails = filterLogs<LogLockToChainEvent>(
            receipt.logs,
            logLockABI,
        ).map((e) => mapLockLogToInputChainTransaction("Ethereun", "BTC", e));
        console.log(lockDetails);
    });

    it("Get mint gateway", async () => {
        const network = RenNetwork.Testnet;
        const ethNetwork = BinanceSmartChain.configMap[network];

        const infuraURL = ethNetwork.network.rpcUrls[0];

        const provider = new providers.JsonRpcProvider(infuraURL);

        console.log(await getMintGateway(ethNetwork, provider, "DAI"));
    });
});
