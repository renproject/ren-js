import { EvmNetworkConfig } from "./types";

export const StandardExplorer = (
    baseUrl: string,
): EvmNetworkConfig["explorer"] => ({
    url: baseUrl,
    address: (address: string) =>
        `${baseUrl.replace(/\/$/, "")}/address/${address}`,
    transaction: (transaction: string) =>
        `${baseUrl.replace(/\/$/, "")}/tx/${transaction || ""}`,
});
