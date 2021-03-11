export interface EthereumConfig {
    name: string;
    chain: string;
    isTestnet: boolean;
    networkID: number;
    chainLabel: string;
    infura: string;
    etherscan: string;
    addresses: {
        GatewayRegistry: string;
        BasicAdapter: string;
    };
}

const ethereumConfig = {
    mainnet: {
        chain: "main",
        isTestnet: false,
        chainLabel: "Mainnet",
        networkID: 1,
        infura: "https://mainnet.infura.io",
        etherscan: "https://etherscan.io",
    },
    kovan: {
        chain: "kovan",
        isTestnet: true,
        chainLabel: "Kovan",
        networkID: 42,
        infura: "https://kovan.infura.io",
        etherscan: "https://kovan.etherscan.io",
    },
    rinkeby: {
        chain: "rinkeby",
        isTestnet: true,
        chainLabel: "Rinkeby",
        networkID: 4,
        infura: "https://rinkeby.infura.io",
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

export const renDevnetVDot3: EthereumConfig = {
    name: "Devnet v0.3",
    ...ethereumConfig.kovan,
    addresses: {
        GatewayRegistry: "0x5045E727D9D9AcDe1F6DCae52B078EC30dC95455",
        BasicAdapter: "0xFABDB1F53Ef8B080332621cBc9F820a39e7A1B83",
    },
};

export const renTestnetVDot3: EthereumConfig = {
    name: "Testnet v0.3",
    ...ethereumConfig.kovan,
    addresses: {
        GatewayRegistry: "0x557e211EC5fc9a6737d2C6b7a1aDe3e0C11A8D5D",
        BasicAdapter: "0x7DDFA2e5435027f6e13Ca8Db2f32ebd5551158Bb",
    },
};

export const renMainnetVDot3: EthereumConfig = {
    name: "Mainnet v0.3",
    ...ethereumConfig.mainnet,
    addresses: {
        GatewayRegistry: "0x503670EC851C55EC1aCFB5230192da921467a24e",
        BasicAdapter: "0xAe65b0f676313Fd715F29D07538d1dc8557f2b1A",
    },
};
