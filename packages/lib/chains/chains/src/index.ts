export * from "@renproject/chains-bitcoin";
export * from "@renproject/chains-ethereum";
export * from "@renproject/chains-filecoin";
export * from "@renproject/chains-terra";
export * from "@renproject/chains-solana";

import {
    Bitcoin,
    BitcoinCash,
    Zcash,
    DigiByte,
    Dogecoin,
} from "@renproject/chains-bitcoin";
import { Terra } from "@renproject/chains-terra";
import { Filecoin } from "@renproject/chains-filecoin";
import {
    Ethereum,
    BinanceSmartChain,
    Fantom,
    Polygon,
    Avalanche,
} from "@renproject/chains-ethereum";
import { Solana } from "@renproject/chains-solana";

const Chains = {
    Bitcoin,
    BitcoinCash,
    Zcash,
    DigiByte,
    Dogecoin,
    Terra,
    Filecoin,
    Ethereum,
    BinanceSmartChain,
    Fantom,
    Polygon,
    Avalanche,
    Solana,
};

export default Chains;
