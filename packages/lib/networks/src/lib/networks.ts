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
            DarknodeRegistry: { address: "0xdaa8c30af85070506f641e456afdb84d4ba972bd", version: "" },
            Orderbook: { address: "0x592d16f8c5fa8f1e074ab3c2cd1acd087adcdc0b", version: "" },
            DarknodeRewardVault: { address: "0x401e7d7ce6f51ea1a8d4f582413e2fabda68daa8", version: "" },
        }),
        [Category.RenEx]: OrderedMap({
            RenExBalances: { address: "0xb3e632943fa995fc75692e46b62383be49cddbc4", version: "" },
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
            DarknodeRegistry: { address: "0x372b6204263c6867f81e2a9e11057ff43efea14b", version: "" },
            Orderbook: { address: "0xa7caa4780a39d8b8acd6a0bdfb5b906210bc76cd", version: "" },
            DarknodeRewardVault: { address: "0x5d62ccc1086f38286dc152962a4f3e337eec1ec1", version: "" },
        }),
        [Category.RenEx]: OrderedMap({
            RenExBalances: { address: "0xc5b98949AB0dfa0A7d4c07Bb29B002D6d6DA3e25", version: "" },
            RenExSettlement: { address: "0xfa0938e3c9a5e33b5084dfbffaca9241aef39be8", version: "" },
            RenExTokens: { address: "0x683fbabff57f1fa71f1b9e2a7eb2a2e11bd7723a", version: "" },
            RenExAtomicInfo: { address: "0xCf85e1Ee45df67Bc9a65B9707a24b64Ac3174259", version: "" },
            RenExAtomicSwapper: { address: "0x266ec5a7Ab363aF718b9ae473A070615E590198D", version: "" },
        }),
        [Category.Tokens]: OrderedMap({
            DGX: { address: "0x0798297a11cefef7479e40e67839fee3c025691e", version: "" },
            REN: { address: "0x6f429121a3bd3e6c1c17edbc676eec44cf117faf", version: "" },
            ABC: { address: "0xc65d2e9c8924d4848935f4f22e3deca78c5217e5", version: "" },
            XYZ: { address: "0x5753addcd942b495b7297cbfc240a24ba7058274", version: "" },
        }),
    }),
};

export const networks = [nightly, falcon, testnet];
