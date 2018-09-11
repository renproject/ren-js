import { OrderedMap } from "immutable";

export enum Category {
    Republic = "Republic",
    RenEx = "RenEx",
    Tokens = "Tokens",
}

export type CategoryAddresses = OrderedMap<string, { address: string; version: string; }>;
export type NetworkAddresses = OrderedMap<string, CategoryAddresses>;

export interface NetworkData {
    name: string;
    chain: string;
    addresses: NetworkAddresses;
}

const nightly: NetworkData = {
    name: "nightly",
    chain: "kovan",
    addresses: OrderedMap({
        [Category.Republic]: OrderedMap({
            DarknodeRegistryStore: { address: "0x6a1439576bb1b5ba2615e290618cb292f4d92014", version: "0.1.0"},
            DarknodeRegistry: { address: "0x8a31d477267a5af1bc5142904ef0afa31d326e03", version: "0.1.0" },
            SettlementRegistry: { address: "0x399a70ed71897836468fd74ea19138df90a78d79", version: "0.1.0"},
            Orderbook: { address: "0x376127adc18260fc238ebfb6626b2f4b59ec9b66", version: "0.1.0" },
            DarknodeRewardVault: { address: "0xda43560f5fe6c6b5e062c06fee0f6fbc71bbf18a", version: "0.1.0" },
            DarknodeSlasher: { address: "0x38458ef4a185455cba57a7594b0143c53ad057c1", version: "0.1.0" },
        }),
        [Category.RenEx]: OrderedMap({
            RenExTokens: { address: "0x160eca47935be4139ec5b94d99b678d6f7e18f95", version: "0.1.0" },
            RenExBrokerVerifier: { address: "0xcf2f6b4b698cd6a6b3eb1d874a939742d15f8e7e", version: "0.1.0" },
            RenExBalances: { address: "0xa95de870ddfb6188519d5cc63ced5e0fbac1aa8e", version: "0.1.0" },
            RenExSettlement: { address: "0x5f25233ca99104d31612d4fb937b090d5a2ebb75", version: "0.1.0" },
            RenExAtomicInfo: { address: "0xe1a660657a32053fe83b19b1177f6b56c6f37b1f", version: "0.1.0" },
            RenExAtomicSwapper: { address: "0x888d1e20e2e94d4d66aa6e80580012c65fc69a78", version: "0.1.0" },
        }),
        [Category.Tokens]: OrderedMap({
            DGX: { address: "0x092ece29781777604afac04887af30042c3bc5df", version: "" },
            REN: { address: "0x15f692d6b9ba8cec643c7d16909e8acdec431bf6", version: "" },
            ABC: { address: "0x49fa7a3b9705fa8deb135b7ba64c2ab00ab915a1", version: "" },
            XYZ: { address: "0x6662449d05312afe0ca147db6eb155641077883f", version: "" },
        }),
    }),
};

const falcon: NetworkData = {
    name: "falcon",
    chain: "kovan",
    addresses: OrderedMap({
        [Category.Republic]: OrderedMap({
            DarknodeRegistryStore: { address: "0x90e12af860038a4b45ddacf99751331376e5bfbb", version: ""},
            DarknodeRegistry: { address: "0xdaa8c30af85070506f641e456afdb84d4ba972bd", version: "" },
            SettlementRegistry: { address: "0x6246ff83ddef23d9509ba80aa3ee650ab0321f0b", version: ""},
            Orderbook: { address: "0x592d16f8c5fa8f1e074ab3c2cd1acd087adcdc0b", version: "" },
            DarknodeRewardVault: { address: "0x401e7d7ce6f51ea1a8d4f582413e2fabda68daa8", version: "" },
            DarknodeSlasher: { address: "0x71ec5f4558e87d6afb5c5ff0b4bdd058d62ed3d1", version: "" },
        }),
        [Category.RenEx]: OrderedMap({
            RenExBalances: { address: "0xb3e632943fa995fc75692e46b62383be49cddbc4", version: "" },
            RenExBrokerVerifier: { address: "0xb6a95aed1588be477981dcdeacd13776570ecb3d", version: "" },
            RenExSettlement: { address: "0xbe936cb23dd9a84e4d9358810f7f275e93ccd770", version: "" },
            RenExTokens: { address: "0x9a898c8148131ef189b1c8575692376403780325", version: "" },
            RenExAtomicInfo: { address: "0xafe5539b40b17404e3cb6cf5013fc7dab3c54163", version: "" },
            RenExAtomicSwapper: { address: "0x937a1c31edc9472beab850897eebf24eee857c0d", version: "" },
        }),
        [Category.Tokens]: OrderedMap({
            DGX: { address: "0xf4faf1b22cee0a024ad6b12bb29ec0e13f5827c2", version: "" },
            REN: { address: "0x87e83f957a2f3a2e5fe16d5c6b22e38fd28bdc06", version: "" },
            ABC: { address: "0xc96884276d70a1176b2fe102469348d224b0a1fa", version: "" },
            XYZ: { address: "0x8a4a68db5ad08c215c6078111be8793843a53302", version: "" },
        }),
    }),
};

const testnet: NetworkData = {
    name: "testnet",
    chain: "kovan",
    addresses: OrderedMap({
        [Category.Republic]: OrderedMap({
            DarknodeRegistryStore: { address: "0x812710a45f75400fc873696ee3335fcc319749d7", version: "0.1.0"},
            DarknodeRegistry: { address: "0xd1c3b5f2fe4eec6c262a5e1b161e5e099fd8325e", version: "0.1.0" },
            SettlementRegistry: { address: "0xc07780d6e1f24434b1766068f0e44b10a5ff5755", version: "0.1.0"},
            Orderbook: { address: "0x9a016649d97d44a055c26cbcadbc45a1ac563c89", version: "0.1.0" },
            DarknodeRewardVault: { address: "0xceac6b255ccdd901fefcdb874db092e6f682fee0", version: "0.1.0" },
            DarknodeSlasher: { address: "0x6c52b2fd5b6c3e6baf47e05af880fc95b9c8079c", version: "0.1.0" },
        }),
        [Category.RenEx]: OrderedMap({
            RenExBalances: { address: "0x99df4a01731b876a6b43a9a6873d080c29992d63", version: "0.1.0" },
            RenExBrokerVerifier: { address: "0x5bf19a6ea8631bb722ade58e0d2c5813740c88fd", version: "0.1.0" },
            RenExSettlement: { address: "0x68fe2088a321a42de11aba93d32c81c9f20b1abe", version: "0.1.0" },
            RenExTokens: { address: "0x92702879dc258860111782cc983e4edfe11450cc", version: "0.1.0" },
            RenExAtomicInfo: { address: "0xd5757db061b1add0dcbf6b9dd3849e98eaef408a", version: "0.1.0" },
            RenExAtomicSwapper: { address: "0xa80c64cc2c3e29b44cab2475f6ead0d523715a4e", version: "0.1.0" },
        }),
        [Category.Tokens]: OrderedMap({
            DGX: { address: "0x842f0db4943174ec458b790868e330444c18c9f2", version: "0.1.0" },
            REN: { address: "0x99806d107eda625516d954621df175a002d223e6", version: "0.1.0" },
            ABC: { address: "0x48ec1d153f97a94140d2ecf0bc836bc6ed2f39d7", version: "0.1.0" },
            PQR: { address: "0x724c964a614Eb0748b48dF79eD5D93C108E361c4", version: "0.1.0" },
            XYZ: { address: "0x9978a1e2cd70904ea15eb2e0d62d1f96e3f135e2", version: "0.1.0" },
        }),
    }),
};

export const networks = [nightly, falcon, testnet];
