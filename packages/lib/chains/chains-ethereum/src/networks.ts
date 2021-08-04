import { EthAddress, EthTransaction } from "./types";

export const StandardExplorer = (baseUrl: string) => ({
    address: (address: EthAddress | string) =>
        `${baseUrl.replace(/\/$/, "")}/address/${address}`,
    transaction: (transaction: EthTransaction | string) =>
        `${baseUrl.replace(/\/$/, "")}/tx/${transaction || ""}`,
});

export interface EthereumConfig {
    name: string;
    chain: string;
    isTestnet: boolean;
    networkID: number;

    /** A title-cased label for the chain. */
    chainLabel: string;

    /**
     * A method for getting a public provider as a URI. Accepts an optional
     * map of provider API keys, as documented by each network.
     *
     * Note that this isn't used by RenJS internally.
     */
    publicProvider: (keys?: {
        infura?: string;
        [key: string]: string | undefined;
    }) => string;

    /**
     * The base URI of an explorer, which should follow the below standard:
     * (1) an address's page should be at $BASE_URL/address/$ADDRESS
     * (2) a transaction's page should be ase $BASE_URL/tx/$TRANSACTION_HASH
     *
     * Used when calling `Ethereum.utils.addressExplorerLink` and
     * `Ethereum.utils.transactionExplorerLink`.
     */
    explorer: {
        address: (address: EthAddress | string) => string;
        transaction: (transaction: EthTransaction | string) => string;
    };

    addresses: {
        GatewayRegistry: string;
        BasicAdapter: string;
    };

    /** @deprecated Renamed to publicProvider. Will be removed in 3.0.0. */
    infura: string;
    /** @deprecated Renamed to explorer. Will be removed in 3.0.0. */
    etherscan: string;
}

const ethereumConfig = {
    mainnet: {
        chain: "main",
        isTestnet: false,
        chainLabel: "Ethereum",
        networkID: 1,

        publicProvider: ({ infura }: { infura?: string } = {}) =>
            `https://mainnet.infura.io/v3/${infura || ""}`,
        explorer: StandardExplorer("https://etherscan.io"),

        /** @deprecated Renamed to publicProvider. Will be removed in 3.0.0. */
        infura: "https://mainnet.infura.io",
        /** @deprecated Renamed to explorer. Will be removed in 3.0.0. */
        etherscan: "https://etherscan.io",
    },
    kovan: {
        chain: "kovan",
        isTestnet: true,
        chainLabel: "Kovan",
        networkID: 42,

        publicProvider: ({ infura }: { infura?: string } = {}) =>
            `https://kovan.infura.io/v3/${infura || ""}`,
        explorer: StandardExplorer("https://kovan.etherscan.io"),

        /** @deprecated Renamed to publicProvider. Will be removed in 3.0.0. */
        infura: "https://kovan.infura.io",
        /** @deprecated Renamed to explorer. Will be removed in 3.0.0. */
        etherscan: "https://kovan.etherscan.io",
    },
    rinkeby: {
        chain: "rinkeby",
        isTestnet: true,
        chainLabel: "Rinkeby",
        networkID: 4,

        publicProvider: ({ infura }: { infura?: string } = {}) =>
            `https://rinkeby.infura.io/v3/${infura || ""}`,
        explorer: StandardExplorer("https://rinkeby.etherscan.io"),

        /** @deprecated Renamed to publicProvider. Will be removed in 3.0.0. */
        infura: "https://rinkeby.infura.io",
        /** @deprecated Renamed to explorer. Will be removed in 3.0.0. */
        etherscan: "https://rinkeby.etherscan.io",
    },
};

export const renMainnet: EthereumConfig = {
    name: "Mainnet",
    ...ethereumConfig.mainnet,
    addresses: {
        GatewayRegistry: "0xe80d347DF1209a76DD9d2319d62912ba98C54DDD",
        BasicAdapter: "0x32666B64e9fD0F44916E1378Efb2CFa3B3B96e80",
    },
};

export const renTestnet: EthereumConfig = {
    name: "Testnet",
    ...ethereumConfig.kovan,
    addresses: {
        GatewayRegistry: "0x557e211EC5fc9a6737d2C6b7a1aDe3e0C11A8D5D",
        BasicAdapter: "0x7DDFA2e5435027f6e13Ca8Db2f32ebd5551158Bb",
    },
};

export const renDevnet: EthereumConfig = {
    name: "Devnet v0.3",
    ...ethereumConfig.kovan,
    addresses: {
        GatewayRegistry: "0x5045E727D9D9AcDe1F6DCae52B078EC30dC95455",
        BasicAdapter: "0xFABDB1F53Ef8B080332621cBc9F820a39e7A1B83",
    },
};

export const renTestnetVDot3 = renTestnet;
export const renMainnetVDot3 = renMainnet;
export const renDevnetVDot3 = renDevnet;
