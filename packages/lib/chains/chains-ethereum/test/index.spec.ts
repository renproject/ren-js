/* eslint-disable no-console */

import * as Chains from "@renproject/chains";

import { BurnDetails } from "@renproject/interfaces";
import { Ox } from "@renproject/utils";
import chai from "chai";
import HDWalletProvider from "@truffle/hdwallet-provider";
import { config as loadDotEnv } from "dotenv";
import Web3 from "web3";
import { EthereumConfig, EthTransaction, renMainnet } from "@renproject/chains";
import BN from "bn.js";
import { getGatewayAddress, eventTopics, parseBurnEvent } from "../src/utils";
import { provider } from "web3-providers";

chai.should();

loadDotEnv();

const MNEMONIC = process.env.MNEMONIC;

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

describe("Refactor: mint", () => {
    it.skip("mint to contract", async function () {
        this.timeout(100000000000);

        const infuraURL = `${Chains.renMainnet.infura}/v3/${process.env.INFURA_KEY}`; // renBscDevnet.infura
        const provider: provider = new HDWalletProvider({
            mnemonic: MNEMONIC || "",
            providerOrUrl: infuraURL,
            addressIndex: 0,
            numberOfAddresses: 10,
        }) as any;
        const web3 = new Web3(provider);

        const txHashes: string[] = [
            "0x066e377aaa55c68db08d1a00c3431886efb24c317d83fc244547d2aba926e506",
            "0x3f7fb0221d825abcceed09ecf1e784858016e12b51ff8ad9d2d115fe78de593c",
            "0x40c277b38c5833947a8d73126747b63c59bace450122f5bd0557e3202f22e7f1",
            "0x771ea2803f2f4012869aea74e1a7183feb13f7a14a31f17b6ed3836b3650435d",
            "0xd6bf8ff0745bcb43cf803786761480353eac7d27f2e4fa7e283229b061998d45",
            "0x7f5c531e1f44cc941490402479457dc8cf70c33d4075e4cef06d68e6f1a94e36",
            "0x98427f9055d1c1651b80981a1c1fdbaaaf9eb8ccb0e543fe846607b59737ce11",
            "0xe3a0a1df6ca6c8cdca6ef87f82af0afc255d95c59e019855afc93526a1b135e5",
            "0x37398b6a0e0627ef7eb9a60c17ef9bf1bc4330fee0213bfd4b50e3c2c400b133",
            "0x80d74c88cf9e42cea918c990f08b83ed6f44d852de19471c35f72689d7978c18",
            "0x417c0fc750719b2742cd2c0c39c8e7708d352912607756e989ef15ddb991ab66",
            "0xd2e80704ee0012e3717fc734703de54abd0259de6ff04c0536a4376791fa574a",
            "0xb9d5fa3c83ebec2bf3d5579a47ce331fccc3d1cc6e48e5e570a56517b13065f9",
            "0x89ed56fe40a1e77fbff55564ec6dfa7364abe62ba8c4b22074c83b836a32ffe3",
            "0xf6ff3b57ad6db50bccafa41620c8be60002fcfd16b2468a958089a3bfce064ca",
            "0xf51b557620ed9c8e00c967fbfb65385763b20d5b813732a5ae3f7c7d1adc3943",
            "0xb454b93a0a629831a2c7f72dd22ce01a047bbf39fdd2422b4115438d98b40e5c",
            "0x1209d279465d6804d08ae6c8f86ef08273a7343855a3644f8544f5b4df0d10fa",
            "0x675496c2f52994eea0aca5912e23d7c381772acf3b492badeccc727e028c92c5",
            "0xd329a6ef1ef5fd7861daab678541ba3bd0ca752b6d0822076041b3241f0f88ee",
            "0x5963a965406a0347c596c73303cec0f0c291bce15d2b9ba8147e3b80f9c69d27",
            "0xd24bf6065878f1ac7b58b5d5b6017db8f40b81eea41031729ddbe1339c7c3ab5",
            "0x1889e7fa55674a2b780986726f7b01401a331c18c10c9714d8ddd8e2f3b7e71d",
            "0xe8f9fbae405881523a25a8714f0616cea0ce63d8853526c2db89b505186be868",
            "0xe00c4124f7f85a15031480c641c414193b0bdbbd7a8b5933d09663b0ffb79615",
        ];

        for (const txHash of txHashes) {
            const receipt = await web3.eth.getTransactionReceipt(txHash);
            console.log(txHash, receipt.from, receipt.to);
        }

        // for (const nonce of nonces) {
        //     console.log(
        //         nonce,
        //         (await findBurnByNonce(renMainnet, web3, "BTC", nonce))
        //             .transaction,
        //     );
        // }
    });
});
