/* eslint-disable no-console */

import { keccak256 } from "@renproject/utils";
import BigNumber from "bignumber.js";
import chai from "chai";
import Web3 from "web3";
import { renTestnet, waitForReceipt } from "@renproject/chains";
import { config as loadDotEnv } from "dotenv";

chai.should();

loadDotEnv();

const transferABI = [
    {
        type: "address",
        name: "from",
        indexed: true,
    },
    {
        type: "address",
        name: "to",
        indexed: true,
    },
    {
        type: "uint256",
        name: "value",
    },
];

const burnABI = [
    { type: "bytes", name: "_to" },
    { type: "uint256", name: "_amount" },
    { type: "uint256", name: "_n", indexed: true },
    { type: "bytes", name: "_indexedTo", indexed: true },
];

const mintABI = [
    { type: "address", name: "_to", indexed: true },
    { type: "uint256", name: "_amount" },
    { type: "uint256", name: "_n", indexed: true },
    { type: "bytes32", name: "_signedMessageHash", indexed: true },
];

describe.skip("RenJS initialization and exports", () => {
    it.skip("check burns", async function () {
        this.timeout(10000000000);
        const infuraURL = `${renTestnet.infura}/v3/${process.env.INFURA_KEY}`;

        const web3 = new Web3(infuraURL);

        const burns = await web3.eth.getPastLogs({
            address: "0x3E31c6E07Eb4C471A6443e90E304E9C68dcdEd7d",
            fromBlock: "1",
            toBlock: "latest",
            // topics: [sha3("LogDarknodeRegistered(address,uint256)"), "0x000000000000000000000000" +
            // address.slice(2), null, null] as any,
            topics: [
                keccak256(
                    Buffer.from("LogBurn(bytes,uint256,uint256,bytes)"),
                ).toString("hex"),
            ] as string[],
        });

        console.debug(`Found ${burns.length} burns...`);

        for (let i = 0; i < burns.length; i++) {
            const burn = burns[i];
            console.debug(
                `Processing ${i}/${burns.length} ${burn.transactionHash}`,
            );
            const receipt = await waitForReceipt(web3, burn.transactionHash);
            if (receipt.logs.length !== 3) {
                console.error(`Expected 3 logs but got ${receipt.logs.length}`);
                continue;
            }
            const [transfer, fee, release] = receipt.logs;
            const transferDecoded = web3.eth.abi.decodeLog(
                transferABI,
                transfer.data,
                transfer.topics as string[],
            );
            const feeDecoded = web3.eth.abi.decodeLog(
                transferABI,
                fee.data,
                fee.topics as string[],
            );
            const releaseDecoded = web3.eth.abi.decodeLog(
                burnABI,
                release.data,
                release.topics as string[],
            );

            const sum = new BigNumber(transferDecoded.value.toString())
                .minus(new BigNumber(feeDecoded.value.toString()))
                .minus(releaseDecoded._amount.toString());

            if (!sum.isZero()) {
                console.debug(burn.transactionHash);
                console.debug("transferDecoded", transferDecoded);
                console.debug("feeDecoded", feeDecoded);
                console.debug("releaseDecoded", releaseDecoded);
                throw new Error("Not zero!!!");
            }
        }
    });

    it("check mints", async function () {
        this.timeout(10000000000);
        const infuraURL = `${renTestnet.infura}/v3/${process.env.INFURA_KEY}`;

        const web3 = new Web3(infuraURL);

        const mints = await web3.eth.getPastLogs({
            address: "0x3E31c6E07Eb4C471A6443e90E304E9C68dcdEd7d",
            fromBlock: "1",
            toBlock: "latest",
            // topics: [sha3("LogDarknodeRegistered(address,uint256)"), "0x000000000000000000000000" +
            // address.slice(2), null, null] as any,
            topics: [
                keccak256(
                    Buffer.from("LogMint(address,uint256,uint256,bytes32)"),
                ).toString("hex"),
            ] as string[],
        });

        console.debug(`Found ${mints.length} mints...`);

        for (let i = 0; i < mints.length; i++) {
            const mint = mints[i];
            console.debug(
                `Processing ${i}/${mints.length} ${mint.transactionHash}`,
            );
            const receipt = await waitForReceipt(web3, mint.transactionHash);
            if (receipt.logs.length !== 3) {
                console.error(`Expected 3 logs but got ${receipt.logs.length}`);
                continue;
            }

            console.debug(receipt);

            const [transfer, fee, mintLog] = receipt.logs;
            const transferDecoded = web3.eth.abi.decodeLog(
                transferABI,
                transfer.data,
                transfer.topics as string[],
            );
            const feeDecoded = web3.eth.abi.decodeLog(
                transferABI,
                fee.data,
                fee.topics as string[],
            );
            const releaseDecoded = web3.eth.abi.decodeLog(
                mintABI,
                mintLog.data,
                mintLog.topics as string[],
            );

            const sum = new BigNumber(transferDecoded.value.toString())
                // .minus(new BigNumber(feeDecoded.value.toString()))
                .minus(releaseDecoded._amount.toString());

            if (!sum.isZero()) {
                console.debug(mint.transactionHash);
                console.debug("transferDecoded", transferDecoded);
                console.debug("feeDecoded", feeDecoded);
                console.debug("releaseDecoded", releaseDecoded);
                throw new Error("Not zero!!!");
            }
        }
    });
});
