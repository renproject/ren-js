import { LCDClient } from "@terra-money/terra.js";

import { TerraNetwork } from "./deposit";

// Cache clients
const clients = {};

export const getHeight = async (network: TerraNetwork): Promise<number> => {
    // connect to testnet

    let prefix;
    switch (network) {
        case TerraNetwork.Columbus:
            prefix = "lcd";
            break;
        case TerraNetwork.Tequila:
            prefix = "tequila-lcd";
            break;
        default:
            throw new Error(`Terra network ${network} not supported.`);
    }

    const terra =
        clients[network] ||
        new LCDClient({
            URL: `https://${prefix}.terra.dev`,
            chainID: network,
        });
    clients[network] = terra;

    const result = await terra.tendermint.blockInfo();

    return parseInt(result.block.header.height, 10);
};
