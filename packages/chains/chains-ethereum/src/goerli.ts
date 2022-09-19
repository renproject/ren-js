import { EthereumBaseChain } from "./base";
import { goerliConfigMap } from "./ethereum";
import { resolveEVMNetworkConfig } from "./utils/generic";

export class Goerli extends EthereumBaseChain {
    // Static members.
    public static chain = "Goerli" as const;
    public static configMap = goerliConfigMap;
    public static assets = {
        gETH: "gETH" as const,
        REN: "REN_Goerli" as const,
        DAI: "DAI_Goerli" as const,
        USDC: "USDC_Goerli" as const,
        USDT: "USDT_Goerli" as const,

        // Aliases
        ETH: "gETH" as const,
    };

    public configMap = goerliConfigMap;
    public assets = Goerli.assets;

    public constructor({
        network,
        ...params
    }: ConstructorParameters<typeof EthereumBaseChain>[0]) {
        super({
            ...params,
            network: resolveEVMNetworkConfig(goerliConfigMap, network),
        });
    }
}
