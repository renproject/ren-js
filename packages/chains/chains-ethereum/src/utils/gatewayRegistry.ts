import { Contract } from "ethers";

import { Provider } from "@ethersproject/providers";
import { ErrorWithCode, Ox } from "@renproject/utils";

import { GatewayRegistryABI } from "../contracts";
import { ETHEREUM_ERROR } from "./errors";
import { EvmNetworkConfig } from "./types";

/**
 * Utilities for fetching gateway contract addresses and token addresses.
 */

/** The equivalent to `address(0x0)` in Solidity. */
const EMPTY_ADDRESS = "0x" + "00".repeat(20);

export const getGatewayRegistry = (
    network: EvmNetworkConfig,
    provider: Provider,
) => {
    return new Contract(
        network.addresses.GatewayRegistry,
        GatewayRegistryABI,
        provider,
    );
};

enum GatewayRegistryLookup {
    MintGateway = "Mint Gateway",
    LockGateway = "Lock Gateway",
    RenAsset = "Ren Asset",
    LockAsset = "Lock Asset",
}

const gatewayRegistryMethods = {
    [GatewayRegistryLookup.MintGateway]: "getMintGatewayBySymbol",
    [GatewayRegistryLookup.LockGateway]: "getLockGatewayBySymbol",
    [GatewayRegistryLookup.RenAsset]: "getRenAssetBySymbol",
    [GatewayRegistryLookup.LockAsset]: "getLockAssetBySymbol",
};

const createGatewayRegistryFetcher =
    (lookup: GatewayRegistryLookup) =>
    async (
        network: EvmNetworkConfig,
        provider: Provider,
        asset: string,
    ): Promise<string> => {
        try {
            const registry = getGatewayRegistry(network, provider);
            const registryAddress: string = Ox(
                await registry[gatewayRegistryMethods[lookup]](asset),
            );
            if (!registryAddress || registryAddress === EMPTY_ADDRESS) {
                throw new ErrorWithCode(
                    `${asset} not supported on network - unable to get ${lookup}`,
                    ETHEREUM_ERROR.ASSET_NOT_SUPPORTED,
                );
            }
            return registryAddress;
        } catch (error) {
            if (error instanceof Error) {
                error.message = `Error looking up ${asset} ${lookup}${
                    error.message ? `: ${String(error.message)}` : "."
                }`;
                (error as ErrorWithCode).code = ETHEREUM_ERROR.NETWORK_ERROR;
            }
            throw error;
        }
    };

export const getMintGateway = createGatewayRegistryFetcher(
    GatewayRegistryLookup.MintGateway,
);
export const getLockGateway = createGatewayRegistryFetcher(
    GatewayRegistryLookup.LockGateway,
);
export const getRenAsset = createGatewayRegistryFetcher(
    GatewayRegistryLookup.RenAsset,
);
export const getLockAsset = createGatewayRegistryFetcher(
    GatewayRegistryLookup.LockAsset,
);
