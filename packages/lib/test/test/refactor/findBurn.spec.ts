export const findBurnByNonce = async (
    network: EthereumConfig,
    web3: Web3,
    asset: string,
    nonce: Buffer | string | number,
): Promise<BurnDetails<EthTransaction>> => {
    const gatewayAddress = await getGatewayAddress(network, web3, asset);

    const nonceBuffer = Buffer.isBuffer(nonce)
        ? nonce
        : new BN(nonce).toArrayLike(Buffer, "be", 32);

    const burnEvents = await web3.eth.getPastLogs({
        address: gatewayAddress,
        fromBlock: "1",
        toBlock: "latest",
        topics: [eventTopics.LogBurn, Ox(nonceBuffer)] as string[],
    });

    if (!burnEvents.length) {
        throw Error(`Burn not found for nonce ${Ox(nonceBuffer)}`);
    }
    if (burnEvents.length > 1) {
        // WARNING: More than one burn with the same nonce.
    }

    return parseBurnEvent(web3, burnEvents[0]);
};

/* eslint-disable no-console */

import * as Chains from "@renproject/chains";

import {
    LockAndMintParams,
    LogLevel,
    RenNetwork,
    SimpleLogger,
} from "@renproject/interfaces";
import RenJS from "@renproject/ren";
import { extractError, SECONDS, sleep } from "@renproject/utils";
import chai from "chai";
import { blue, cyan, green, magenta, red, yellow } from "chalk";
import CryptoAccount from "send-crypto";
import HDWalletProvider from "@truffle/hdwallet-provider";
import { config as loadDotEnv } from "dotenv";
import BigNumber from "bignumber.js";
import { TerraAddress } from "@renproject/chains-terra/build/main/api/deposit";
import { provider } from "web3-core";

chai.should();

loadDotEnv();

const colors = [green, magenta, yellow, cyan, blue, red];

const MNEMONIC = process.env.MNEMONIC;
const PRIVATE_KEY = process.env.TESTNET_PRIVATE_KEY;

const FAUCET_ASSETS = ["BTC", "ZEC", "BCH", "ETH", "FIL", "LUNA"];

describe("Refactor: mint", () => {
    const longIt = process.env.ALL_TESTS ? it : it.skip;
    it.skip("mint to contract", async function () {
        const infuraURL = `${Chains.renDevnetVDot3.infura}/v3/${process.env.INFURA_KEY}`; // renBscDevnet.infura
        const provider: provider = new HDWalletProvider({
            mnemonic: MNEMONIC || "",
            providerOrUrl: infuraURL,
            addressIndex: 0,
            numberOfAddresses: 10,
        }) as any;
        const web3 = new Web3(provider);
    });
});
