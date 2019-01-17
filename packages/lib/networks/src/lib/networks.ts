export enum Category {
    Republic = "republic",
    RenEx = "renEx",
    Tokens = "tokens",
    Other = "other",
}

export interface ContractDetails {
    address: string;
    version: string;
    new?: true;
}

export interface NetworkAddresses {
    [Category.Republic]: {
        darknodeRegistryStore: ContractDetails;
        darknodeRegistry: ContractDetails;
        settlementRegistry: ContractDetails;
        orderbook: ContractDetails;
        darknodeRewardVault: ContractDetails;
        darknodeSlasher: ContractDetails;
    };
    [Category.RenEx]: {
        renExTokens: ContractDetails;
        renExBrokerVerifier: ContractDetails;
        renExBalances: ContractDetails;
        renExSettlement: ContractDetails;
        renExAtomicSwapper: ContractDetails;
    };
    [Category.Tokens]: {
        DGX: ContractDetails;
        REN: ContractDetails;
        TUSD: ContractDetails;
        OMG: ContractDetails;
        ZRX: ContractDetails;
    };
    [Category.Other]: {
        wyre: ContractDetails;
    };
}

export interface NetworkData {
    name: string;
    chain: string;
    infura: string;
    etherscan: string;
    addresses: NetworkAddresses;
}

// const falcon: NetworkData = {
//     name: "falcon",
//     chain: "kovan",
//     addresses: {
//         [Category.Republic]: {
//             DarknodeRegistryStore: { address: "0x90e12af860038a4b45ddacf99751331376e5bfbb", version: "" },
//             DarknodeRegistry: { address: "0xdaa8c30af85070506f641e456afdb84d4ba972bd", version: "" },
//             SettlementRegistry: { address: "0x6246ff83ddef23d9509ba80aa3ee650ab0321f0b", version: "" },
//             Orderbook: { address: "0x592d16f8c5fa8f1e074ab3c2cd1acd087adcdc0b", version: "" },
//             DarknodeRewardVault: { address: "0x401e7d7ce6f51ea1a8d4f582413e2fabda68daa8", version: "" },
//             DarknodeSlasher: { address: "0x71ec5f4558e87d6afb5c5ff0b4bdd058d62ed3d1", version: "" },
//         },
//         [Category.RenEx]: {
//             RenExTokens: { address: "0x9a898c8148131ef189b1c8575692376403780325", version: "" },
//             RenExBalances: { address: "0xb3e632943fa995fc75692e46b62383be49cddbc4", version: "" },
//             RenExBrokerVerifier: { address: "0xb6a95aed1588be477981dcdeacd13776570ecb3d", version: "" },
//             RenExSettlement: { address: "0xbe936cb23dd9a84e4d9358810f7f275e93ccd770", version: "" },
//             RenExAtomicSwapper: { address: "0x937a1c31edc9472beab850897eebf24eee857c0d", version: "" },
//         },
//         [Category.Tokens]: {
//             DGX: { address: "0xf4faf1b22cee0a024ad6b12bb29ec0e13f5827c2", version: "" },
//             REN: { address: "0x87e83f957a2f3a2e5fe16d5c6b22e38fd28bdc06", version: "" },
//             TUSD: { address: "0xc96884276d70a1176b2fe102469348d224b0a1fa", version: "" },
//             OMG: { address: "0x8a4a68db5ad08c215c6078111be8793843a53302", version: "" },
//             ZRX: { address: "0x0000000000000000000000000000000000000000", version: "" },
//         },
//         [Category.Other]: {
//             Wyre: { address: "0xB14fA2276D8bD26713A6D98871b2d63Da9eefE6f", version: "" },
//         }
//     },
// };
