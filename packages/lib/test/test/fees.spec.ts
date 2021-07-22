/* eslint-disable no-console */

import { Bitcoin, Ethereum } from "@renproject/chains";

import { provider } from "web3-core";
import RenJS from "@renproject/ren";
import chai, { expect } from "chai";
import { config as loadDotEnv } from "dotenv";
import { RenNetwork } from "@renproject/interfaces";
import HDWalletProvider from "@truffle/hdwallet-provider";

chai.should();
loadDotEnv();

const MNEMONIC = process.env.MNEMONIC;

// describe("Fees", () => {
//     it("fees can be fetched", async function () {
//         this.timeout(100000000000);

//         const network = RenNetwork.Mainnet;

//         const ToClass = Ethereum;

//         const ethNetwork = ToClass.configMap[network];

//         const infuraURL = ethNetwork.publicProvider({
//             infura: process.env.INFURA_KEY,
//         });
//         const ethereumProvider: provider = new HDWalletProvider({
//             mnemonic: MNEMONIC || "",
//             providerOrUrl: infuraURL,
//             addressIndex: 0,
//             numberOfAddresses: 10,
//         }) as unknown as provider;

//         const renJS = new RenJS("mainnet");
//         const fees = await renJS.getFees({
//             asset: "BTC",
//             from: Bitcoin(),
//             to: Ethereum(ethereumProvider, "mainnet"),
//         });

//         expect(fees.mint).to.be.greaterThan(10).and.lessThan(30);
//         expect(fees.burn).to.be.greaterThan(10).and.lessThan(30);
//         expect(fees.lock.isGreaterThan(0)).to.be.true;
//         expect(fees.release.isGreaterThan(0)).to.be.true;
//     });
// });
