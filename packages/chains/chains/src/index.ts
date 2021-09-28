export * from "@renproject/chains-bitcoin";
export * from "@renproject/chains-ethereum";
export * from "@renproject/chains-filecoin";
export * from "@renproject/chains-terra";
export * from "@renproject/chains-solana";

import {
    Bitcoin,
    BitcoinCash,
    DigiByte,
    Dogecoin,
    Zcash,
} from "@renproject/chains-bitcoin";
import { BinanceSmartChain, Ethereum } from "@renproject/chains-ethereum";
import { Filecoin } from "@renproject/chains-filecoin";
import { Solana } from "@renproject/chains-solana";
import { Terra } from "@renproject/chains-terra";

const Chains = {
    // Avalanche,
    // BinanceSmartChain,
    Bitcoin,
    BitcoinCash,
    DigiByte,
    Dogecoin,
    Ethereum,
    // Fantom,
    Filecoin,
    // Goerli,
    // Polygon,
    Solana,
    Terra,
    Zcash,
};

export default Chains;
