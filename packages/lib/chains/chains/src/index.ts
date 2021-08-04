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
    Avalanche,
    BinanceSmartChain,
    Ethereum,
    Fantom,
    Goerli,
    Polygon,
} from "@renproject/chains-ethereum";
import { Solana } from "@renproject/chains-solana";

const Chains = {
    Avalanche,
    BinanceSmartChain,
    Bitcoin,
    BitcoinCash,
    DigiByte,
    Dogecoin,
    Ethereum,
    Fantom,
    Filecoin,
    Goerli,
    Polygon,
    Solana,
    Terra,
    Zcash,
};

export default Chains;
