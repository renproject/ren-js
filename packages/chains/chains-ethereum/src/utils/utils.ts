import { RenNetwork } from "../../../../interfaces/build/main";
import {
    EvmNetworkConfig,
    EvmNetworkConfigMap,
    EvmNetworkInput,
    isEvmNetworkConfig,
} from "./types";

export interface EvmExplorer {
    url: string;
    address: (address: string) => string;
    transaction: (txid: string) => string;
}

/**
 * Returns an EvmExplorer with the format `${url}/address/${address}` and
 * `${url}/tx/${txHash}` for addresses and transactions respectively.
 */
export const StandardEvmExplorer = (baseUrl: string): EvmExplorer => ({
    url: baseUrl,

    address: (address: string) =>
        `${baseUrl.replace(/\/$/, "")}/address/${address}`,

    transaction: (txHash: string) =>
        `${baseUrl.replace(/\/$/, "")}/tx/${txHash || ""}`,
});

export const resolveEvmNetworkConfig = (
    configMap: EvmNetworkConfigMap,
    renNetwork: EvmNetworkInput,
): EvmNetworkConfig => {
    if (!renNetwork) {
        const defaultNetwork =
            configMap[RenNetwork.Mainnet] ||
            configMap[RenNetwork.Testnet] ||
            configMap[RenNetwork.Devnet];
        if (!defaultNetwork) {
            throw new Error(`Must provide network.`);
        }
        return defaultNetwork;
    }

    let networkConfig: EvmNetworkConfig | undefined;
    if (renNetwork && isEvmNetworkConfig(renNetwork)) {
        networkConfig = renNetwork;
    } else {
        networkConfig = configMap[renNetwork];
    }

    if (!networkConfig) {
        throw new Error(
            `Unsupported network '${String(
                renNetwork
                    ? typeof renNetwork === "string"
                        ? renNetwork
                        : renNetwork.selector
                    : renNetwork,
            )}'. Valid options are 'mainnet', 'testnet' or an EvmNetworkConfig object.`,
        );
    }

    return networkConfig;
};
