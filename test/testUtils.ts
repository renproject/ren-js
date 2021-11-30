import BigNumber from "bignumber.js";
import chai from "chai";
import chalk from "chalk";
import { config as loadDotEnv } from "dotenv";
import { providers, Wallet } from "ethers";
import SendCrypto from "send-crypto";

import { RenNetwork } from "@renproject/utils";

import {
    EthereumBaseChain,
    EthProvider,
    EvmNetworkConfig,
} from "../packages/chains/chains-ethereum/src";

chai.should();

loadDotEnv();

const MNEMONIC = process.env.MNEMONIC;

interface EVMConstructor<EVM> {
    configMap: {
        [network in RenNetwork]?: EvmNetworkConfig;
    };

    new (renNetwork: RenNetwork, web3Provider: EthProvider): EVM;
}

export const getEVMProvider = <EVM>(
    ChainClass: EVMConstructor<EVM>,
    network: RenNetwork,
): EthProvider => {
    const urls = ChainClass.configMap[network].network.rpcUrls;
    let rpcUrl = urls[0];
    if (process.env.INFURA_KEY) {
        const infuraRegEx = /^https:\/\/.*\$\{INFURA_API_KEY\}/;
        for (const url of urls) {
            if (infuraRegEx.exec(url)) {
                rpcUrl = url.replace(
                    /\$\{INFURA_API_KEY\}/,
                    process.env.INFURA_KEY,
                );
                break;
            }
        }
    }

    const provider = new providers.JsonRpcProvider(rpcUrl);
    const signer = Wallet.fromMnemonic(MNEMONIC).connect(provider);

    return {
        provider,
        signer,
    };
};

// import CryptoAccount from "send-crypto";
// import { renTestnet } from "@renproject/chains-solana/build/main/networks";
// import { makeTestProvider } from "@renproject/chains-solana/build/main/utils";
// const testPK = Buffer.from(process.env.TESTNET_SOLANA_KEY, "hex");

export const getSolanaChain = (_network: RenNetwork) => {
    // console.log(toChain.provider.wallet.publicKey.toString());

    // if ((toChain as any).createAssociatedTokenAccount) {
    //     console.log("Calling createAssociatedTokenAccount...");
    //     await (toChain as any).createAssociatedTokenAccount(asset);
    // }

    throw new Error("Not implemented.");
};

/**
 * Print the name of a chain in a color associated with the chain (e.g. )
 */
export const printChain = (chain: string, { pad } = { pad: true }): string => {
    const color: chalk.Chalk =
        chain === "Ethereum"
            ? chalk.hex("#627eea")
            : chain === "Solana"
            ? chalk.hex("#14f195")
            : chain === "BinanceSmartChain"
            ? chalk.hex("#f9b72d")
            : chain === "Fantom"
            ? chalk.hex("#1969ff")
            : chain === "Polygon"
            ? chalk.hex("#8247e5")
            : chain === "Avalanche"
            ? chalk.hex("#e84142")
            : chain === "Goerli"
            ? chalk.keyword("paleturquoise")
            : chain === "Bitcoin"
            ? chalk.hex("#f7931a")
            : chalk.cyan;
    if (chain === "BinanceSmartChain") {
        chain = "BSC";
    }
    if (pad) {
        if (chain.length > 8) {
            chain = chain.slice(0, 7) + "…";
        }
        if (chain.length < 8) {
            const difference = 8 - chain.length;
            const left = Math.floor(difference / 2);
            const right = Math.ceil(difference / 2);
            chain = " ".repeat(left) + chain + " ".repeat(right);
        }
    }
    return color(chain);
};

export const sendFunds = async (
    asset: string,
    recipient: string,
    amount: BigNumber,
) => {
    const account = new SendCrypto(
        Buffer.from(process.env.TESTNET_PRIVATE_KEY, "hex"),
        {
            network: "testnet",
            apiAddress: "https://multichain-web-proxy.herokuapp.com/testnet",
            terra: {
                URL: "https://bombay-fcd.terra.dev",
            },
        },
    );

    console.log(
        `${chalk.blue("[faucet]")} Sending ${chalk.blue(
            amount.toFixed(),
        )} ${chalk.blue(asset)} to ${chalk.blue(recipient)}`,
    );
    await account.send(recipient, amount, asset);
};
