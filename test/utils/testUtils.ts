/* eslint-disable no-console */

import { Buffer } from "buffer";

import { getEVMProvider } from "@renproject/chains-ethereum/src/utils/generic";
import BigNumber from "bignumber.js";
import chai from "chai";
import chalk from "chalk";
import { config as loadDotEnv } from "dotenv";
import { Solana } from "packages/chains/chains-solana/src";
import { signerFromPrivateKey } from "packages/chains/chains-solana/src/utils";
import { Chain, EthereumBaseChain } from "packages/chains/chains/build";
import { ChainCommon, RenNetwork, utils } from "packages/utils/src";
import SendCrypto from "send-crypto";

import {
    Arbitrum,
    Avalanche,
    BinanceSmartChain,
    Bitcoin,
    BitcoinCash,
    Catalog,
    DigiByte,
    Dogecoin,
    Ethereum,
    Fantom,
    Filecoin,
    Goerli,
    Kava,
    Moonbeam,
    Optimism,
    Polygon,
    Terra,
    Zcash,
} from "../../packages/chains/chains/src";

chai.should();

loadDotEnv();

const MNEMONIC = process.env.MNEMONIC;

export const initializeChain = <T extends ChainCommon>(
    Chain: {
        chain: string;
        new (...params): T;
    },
    network = RenNetwork.Testnet,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
        case Moonbeam.chain:
        case Optimism.chain:
        case Catalog.chain:
            return new (Chain as unknown as typeof Ethereum)({
                network,
                ...getEVMProvider(
                    Chain.chain === "Ethereum"
                        ? Ethereum.configMap[network]
                        : (
                              Chain as unknown as {
                                  configMap: EthereumBaseChain["configMap"];
                              }
                          ).configMap[network],
                    {
                        mnemonic: MNEMONIC,
                    },
                    {
                        INFURA_API_KEY: process.env.INFURA_KEY,
                    },
                ),
                defaultTestnet: "goerli",
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

const colors: { [chain in Chain]: string } = {
    [Chain.Arbitrum]: "#28A0F0",
    [Chain.Avalanche]: "#e84142",
    [Chain.BinanceSmartChain]: "#f9b72d",
    [Chain.Bitcoin]: "#f7931a",
    [Chain.BitcoinCash]: "#6CC64B",
    [Chain.Catalog]: "#2CC995",
    [Chain.DigiByte]: "#0063CF",
    [Chain.Dogecoin]: "#C2A633",
    [Chain.Ethereum]: "#627eea",
    [Chain.Fantom]: "#1969ff",
    [Chain.Filecoin]: "#0090FF",
    [Chain.Goerli]: "#afeeee",
    [Chain.Kava]: "#FF433E",
    [Chain.Moonbeam]: "#53CBC8",
    [Chain.Optimism]: "#FF0420",
    [Chain.Polygon]: "#8247e5",
    [Chain.Solana]: "#14f195",
    [Chain.Terra]: "#F9D85E",
    [Chain.Zcash]: "#F3B63B",
};

/**
 * Print the name of a chain in a color associated with the chain (e.g. )
 */
export const printChain = (chain: string, { pad } = { pad: true }): string => {
    const color = chalk.hex(colors[chain] || "#ffffff");

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
): Promise<void> => {
    const account = new SendCrypto(
        Buffer.from(utils.fromHex(process.env.TESTNET_PRIVATE_KEY)),
        {
            network: "testnet",
            apiAddress: "https://api.calibration.node.glif.io",
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
