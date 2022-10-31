import { RenNetwork } from "@renproject/utils";

import { EthereumBaseChain } from "./base";
import { EthereumTestnet, goerliConfigMap } from "./ethereum";
import { resolveEVMNetworkConfig } from "./utils/generic";

export class Goerli extends EthereumBaseChain {
    // Static members.
    public static chain = "Goerli" as const;
    public static configMap = goerliConfigMap;
    public static assets = {
        [RenNetwork.Testnet]: {
            gETH: "gETH" as const,
            REN: "REN_Goerli" as const,
            DAI: "DAI_Goerli" as const,
            USDC: "USDC_Goerli" as const,
            USDT: "USDT_Goerli" as const,

            // Aliases
            ETH: "gETH" as const,
            ETH_Goerli: "gETH" as const,
            REN_Goerli: "REN_Goerli" as const,
            DAI_Goerli: "DAI_Goerli" as const,
            USDC_Goerli: "USDC_Goerli" as const,
            USDT_Goerli: "USDT_Goerli" as const,
        },
    };

    public configMap = goerliConfigMap;
    public assets: typeof Goerli.assets[RenNetwork.Testnet];

    public constructor({
        network,
        ...params
    }: ConstructorParameters<typeof EthereumBaseChain>[0] & {
        defaultTestnet?: EthereumTestnet.Goerli | `${EthereumTestnet.Goerli}`;
    }) {
        super({
            ...params,
            network: resolveEVMNetworkConfig(goerliConfigMap, network),
        });
        this.assets = Goerli.assets[RenNetwork.Testnet];
    }
}
