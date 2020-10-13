// tslint:disable: no-console

import { Bitcoin, Ethereum, Filecoin } from "@renproject/chains";
import { RenNetwork } from "@renproject/interfaces";
import { renRinkeby } from "@renproject/networks";
import {
    HttpProvider,
    OverwriteProvider,
    Provider,
} from "@renproject/provider";
import RenJS from "@renproject/ren";
import { AbstractRenVMProvider } from "@renproject/rpc";
import {
    RenVMParams,
    RenVMProvider,
    RenVMProviderInterface,
    RenVMResponses,
} from "@renproject/rpc/src/v2";
import { extractError } from "@renproject/utils";
import BigNumber from "bignumber.js";
import chai from "chai";
import { red } from "chalk";
import CryptoAccount from "send-crypto";
import HDWalletProvider from "truffle-hdwallet-provider";

chai.should();

require("dotenv").config();

const MNEMONIC = process.env.MNEMONIC;
const PRIVATE_KEY = process.env.TESTNET_PRIVATE_KEY;

describe("Refactor - Burning", () => {
    // tslint:disable-next-line: mocha-no-side-effect-code
    const longIt = process.env.ALL_TESTS ? it : it.skip;
    // tslint:disable-next-line: mocha-no-side-effect-code
    longIt("burning from contract", async function() {
        this.timeout(100000000000);

        const infuraURL = `${renRinkeby.infura}/v3/${process.env.INFURA_KEY}`; // renBscTestnet.infura
        const provider = new HDWalletProvider(MNEMONIC, infuraURL, 0, 10);

        // Bitcoin recipient.
        // const asset = "BTC";
        // const account = new CryptoAccount(PRIVATE_KEY, { network: "testnet" });
        // const recipient = await account.address(asset);
        // const to = Bitcoin().Address(recipient);

        const asset = "FIL";
        const to = Filecoin().Address(
            "t1zl3sj2t7eazaojiqytccq4zlwosjxixsnf4rhyy"
        );

        const from = Ethereum(provider, undefined, renRinkeby);

        const httpProvider = new HttpProvider<RenVMParams, RenVMResponses>(
            "https://lightnode-new-testnet.herokuapp.com/",
            // tslint:disable-next-line: no-http-string
            // "http://34.239.188.210:18515",
            { verbose: true }
        ) as Provider<RenVMParams, RenVMResponses>;
        const rpcProvider = new OverwriteProvider<RenVMParams, RenVMResponses>(
            // "https://lightnode-new-testnet.herokuapp.com/",
            httpProvider
        ) as RenVMProviderInterface;
        const renVMProvider = new RenVMProvider(
            "testnet",
            rpcProvider
        ) as AbstractRenVMProvider;

        const renJS = new RenJS(renVMProvider);

        // Use 0.0001 more than fee.
        let suggestedAmount: number | string;
        try {
            const fees = await renJS.getFees();
            suggestedAmount = Math.floor(
                fees[asset.toLowerCase()].burn + 0.0001 * 1e8
            );
        } catch (error) {
            console.error("Error fetching fees:", red(extractError(error)));
            suggestedAmount = new BigNumber(0.03)
                .times(new BigNumber(10).exponentiatedBy(18))
                .toFixed();
        }

        const gateway = await from.getGatewayContractAddress(asset);

        const burnAndRelease = await renJS.burnAndRelease({
            asset,
            to,
            from: from.Contract(btcAddress => ({
                // The contract we want to interact with
                sendTo: gateway,

                // The name of the function we want to call
                contractFn: "burn",

                // Arguments expected for calling `deposit`
                contractParams: [
                    {
                        type: "bytes" as const,
                        name: "_to",
                        value: btcAddress,
                    },
                    {
                        type: "uint256" as const,
                        name: "_amount",
                        value: suggestedAmount,
                    },
                ],
            })),
        });

        let confirmations = 0;

        await burnAndRelease
            .burn()
            .on("confirmation", confs => {
                confirmations = confs;
            })
            .on("transactionHash", console.log);

        await burnAndRelease
            .release()
            .on("status", status =>
                status === "confirming"
                    ? console.log(`confirming (${confirmations}/15)`)
                    : console.log(status)
            )
            .on("txHash", console.log);
    });

    // tslint:disable-next-line: mocha-no-side-effect-code
    longIt("burning from address", async function() {
        this.timeout(100000000000);

        const infuraURL = `${renRinkeby.infura}/v3/${process.env.INFURA_KEY}`; // renBscTestnet.infura
        const provider = new HDWalletProvider(MNEMONIC, infuraURL, 0, 10);

        const asset = "BTC";
        const from = Ethereum(provider, undefined, renRinkeby);

        const account = new CryptoAccount(PRIVATE_KEY, { network: "testnet" });
        const recipient = await account.address(asset);

        const renJS = new RenJS("testnet");

        // Use 0.0001 more than fee.
        const fees = await renJS.getFees();
        const suggestedAmount = new BigNumber(
            Math.floor(fees[asset.toLowerCase()].burn + 0.0001 * 1e8)
        )
            .decimalPlaces(0)
            .toFixed();

        const burnAndRelease = await renJS.burnAndRelease({
            asset,
            to: Bitcoin().Address(recipient),
            from: from.Account({ value: suggestedAmount }),
        });

        let confirmations = 0;

        await burnAndRelease
            .burn()
            .on("confirmation", confs => {
                confirmations = confs;
            })
            .on("transactionHash", console.log);

        await burnAndRelease
            .release()
            .on("status", status =>
                status === "confirming"
                    ? console.log(`confirming (${confirmations}/15)`)
                    : console.log(status)
            )
            .on("txHash", console.log);
    });
});
