import { Buffer } from "buffer";

import { EthProvider, EVMNetworkConfig } from "@renproject/chains-ethereum/src";
import { Connection } from "@solana/web3.js";
import BigNumber from "bignumber.js";
import chai from "chai";
import chalk from "chalk";
import { config as loadDotEnv } from "dotenv";
import { ethers, providers, Wallet } from "ethers";
import {
    GatewayRegistryABI,
    getERC20Instance,
    getGatewayRegistryInstance,
    getMintGatewayInstance,
} from "packages/chains/chains-ethereum/src/contracts";
import { Kava } from "packages/chains/chains-ethereum/src/kava";
import { Solana } from "packages/chains/chains-solana/src";
import { renTestnet } from "packages/chains/chains-solana/src/networks";
import { signerFromPrivateKey } from "packages/chains/chains-solana/src/utils";
import { ChainCommon, RenNetwork, utils } from "packages/utils/src";
import SendCrypto from "send-crypto";

import {
    Arbitrum,
    Avalanche,
    BinanceSmartChain,
    Bitcoin,
    BitcoinCash,
    DigiByte,
    Dogecoin,
    Ethereum,
    EthereumClassConfig,
    EthSigner,
    Fantom,
    Filecoin,
    Goerli,
    Polygon,
    Terra,
    Zcash,
} from "../../packages/chains/chains/src";

chai.should();

loadDotEnv();

const MNEMONIC = process.env.MNEMONIC;

interface EVMConstructor<EVM> {
    configMap: {
        [network in RenNetwork]?: EVMNetworkConfig;
    };

    new ({
        network,
        provider,
        signer,
        config,
    }: {
        network: EVMNetworkConfig;
        provider: EthProvider;
        signer?: EthSigner;
        config?: EthereumClassConfig;
    }): EVM;
}

export const getEVMProvider = <EVM>(
    ChainClass: EVMConstructor<EVM>,
    network: RenNetwork,
    index: number = 0,
): {
    provider: EthProvider;
    // signer: EthSigner;
} => {
    const urls = ChainClass.configMap[network].config.rpcUrls;
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

    const provider = new ethers.providers.JsonRpcProvider(rpcUrl);
    const signer = Wallet.fromMnemonic(
        MNEMONIC,
        `m/44'/60'/0'/0/${index}`,
    ).connect(provider);

    return {
        provider,
        // signer,
    };
};

export const initializeChain = <T extends ChainCommon>(
    Chain: {
        chain: string;
        new (...params): T;
    },
    network = RenNetwork.Testnet,
    config?: any,
): T => {
    switch (Chain.chain) {
        // Bitcoin chains
        case Bitcoin.chain:
        case BitcoinCash.chain:
        case Zcash.chain:
        case DigiByte.chain:
        case Dogecoin.chain:
            return new (Chain as unknown as typeof Bitcoin)({
                network,
            }) as ChainCommon as T;

        // Filecoin
        case Filecoin.chain:
            return new (Chain as unknown as typeof Filecoin)({
                network,
            }) as ChainCommon as T;

        // Terra
        case Terra.chain:
            return new (Chain as unknown as typeof Terra)({
                network,
            }) as ChainCommon as T;

        // EVM chains
        case Ethereum.chain:
        case BinanceSmartChain.chain:
        case Fantom.chain:
        case Polygon.chain:
        case Arbitrum.chain:
        case Avalanche.chain:
        case Goerli.chain:
        case Kava.chain:
            return new (Chain as unknown as typeof Ethereum)({
                network,
                ...getEVMProvider(Chain as unknown as typeof Ethereum, network),
                config,
            }) as ChainCommon as T;

        // Solana
        case Solana.chain:
            return new (Chain as unknown as typeof Solana)({
                network,
                signer: signerFromPrivateKey(
                    Buffer.from(process.env.TESTNET_SOLANA_KEY, "hex"),
                ),
                config,
            }) as ChainCommon as T;
    }
    throw new Error(`No test initializer for ${Chain.chain}.`);
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
        Buffer.from(utils.fromHex(process.env.TESTNET_PRIVATE_KEY)),
        {
            network: "testnet",
            apiAddress: "https://multichain-web-proxy.herokuapp.com/testnet",
            terra: {
                URL: "https://bombay-fcd.terra.dev",
            },
        },
    );

    const faucetAddress = await account.address(asset);
    const faucetBalance = await account.getBalance(asset);

    console.debug(
        `${chalk.blue("[faucet]")} Sending ${chalk.blue(
            amount.toFixed(),
        )} ${chalk.blue(asset)} to ${chalk.blue(
            recipient,
        )} (from ${faucetAddress}, balance: ${faucetBalance} ${asset})`,
    );
    const sent = await account.send(recipient, amount, asset);
    console.debug(`${chalk.blue("[faucet]")} Sent: ${chalk.blue(sent)}`);
};
