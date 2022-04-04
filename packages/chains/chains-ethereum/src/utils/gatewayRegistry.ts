import { Provider } from "@ethersproject/providers";
import { ErrorWithCode, utils } from "@renproject/utils";

import { getGatewayRegistryInstance } from "../contracts";
import { EVM_ERROR } from "./errors";
import { EVMNetworkConfig } from "./types";

/**
 * Utilities for fetching gateway contract addresses and token addresses.
 */

/** The equivalent to `address(0x0)` in Solidity. */
const EMPTY_ADDRESS = "0x" + "00".repeat(20);

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
        network: EVMNetworkConfig,
        provider: Provider,
        asset: string,
    ): Promise<string> => {
        try {
            const registry = getGatewayRegistryInstance(
                provider,
                network.addresses.GatewayRegistry,
            );
            const registryAddress: string = utils.Ox(
                await registry[gatewayRegistryMethods[lookup]](asset),
            );
            if (!registryAddress || registryAddress === EMPTY_ADDRESS) {
                throw new ErrorWithCode(
                    `${asset} not supported on ${network.selector} - unable to get ${asset} ${lookup}`,
                    EVM_ERROR.ASSET_NOT_SUPPORTED,
                );
            }
            return registryAddress;
        } catch (error: unknown) {
            throw ErrorWithCode.updateError(
                error,
                EVM_ERROR.NETWORK_ERROR,
                `Error looking up ${asset} ${lookup}`,
            );
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
