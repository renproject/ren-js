import { OrderedMap } from "immutable";

export enum Category {
    Republic = "Republic",
    RenEx = "RenEx",
    Tokens = "Tokens",
}

export interface NetworkData {
    name: string;
    chain: string;
    addresses: OrderedMap<string, OrderedMap<string, string>>;
}

const nightly: NetworkData = {
    name: "nightly",
    chain: "kovan",
    addresses: OrderedMap({
        [Category.Republic]: OrderedMap({
            DarknodeRegistry: "0xb3972e45d16b0942ed34943fdde413190cf5b12a",
            Orderbook: "0x8356e57aa32547685149a859293ad83c144b800c",
            RewardVault: "0x7214c4584ab01e61355244e2325ab3f40aca4d85",
        }),
        [Category.RenEx]: OrderedMap({
            RenExBalances: "0xc2c126e1eb32e6ad50c611fb92d009b4b4518b00",
            RenExSettlement: "0x65712325c41fb39b9205e08483b43142d919cc42",
            RenExTokens: "0x3672b60236b76d30b64455515efa38e06f64e3df",
            RenExAtomicInfo: "0x6aa8c4d3035dbf83c24c604b530da8be396e8968",
            RenExAtomicSwapper: "0x027b780a3210702178db0719e42c66808840b0c7",
        }),
        [Category.Tokens]: OrderedMap({
            DGX: "0x092ece29781777604afac04887af30042c3bc5df",
            REN: "0x15f692d6b9ba8cec643c7d16909e8acdec431bf6",
            ABC: "0x49fa7a3b9705fa8deb135b7ba64c2ab00ab915a1",
            XYZ: "0x6662449d05312afe0ca147db6eb155641077883f",
        }),
    }),
};

const falcon: NetworkData = {
    name: "falcon",
    chain: "kovan",
    addresses: OrderedMap({
        [Category.Republic]: OrderedMap({
            DarknodeRegistry: "0xfafd5c83d1e21763b79418c4ecb5d62b4970df8e",
            Orderbook: "0x044b08eec761c39ac32aee1d6ef0583812f21699",
            RewardVault: "0x0e6bbbb35835cc3624a000e1698b7b68e9eec7df",
        }),
        [Category.RenEx]: OrderedMap({
            RenExBalances: "0x3083e5ba36c6b42ca93c22c803013a4539eedc7f",
            RenExSettlement: "0x8617dcd709bb8660602ef70ade78626b7408a210",
            RenExTokens: "0xb8bf2497639c95e203195cc9f333510a0d99c716",
            RenExAtomicInfo: "0x460ec601e1126917a54f65455d4ac51f68716adf",
            RenExAtomicSwapper: "0x027b780a3210702178db0719e42c66808840b0c7",
        }),
        [Category.Tokens]: OrderedMap({
            DGX: "0xf4faf1b22cee0a024ad6b12bb29ec0e13f5827c2",
            REN: "0x87e83f957a2f3a2e5fe16d5c6b22e38fd28bdc06",
            ABC: "0xc96884276d70a1176b2fe102469348d224b0a1fa",
            XYZ: "0x8a4a68db5ad08c215c6078111be8793843a53302",
        }),
    }),
};

const testnet: NetworkData = {
    name: "testnet",
    chain: "kovan",
    addresses: OrderedMap({
        [Category.Republic]: OrderedMap({
            DarknodeRegistry: "0x372b6204263c6867f81e2a9e11057ff43efea14b",
            Orderbook: "0xa7caa4780a39d8b8acd6a0bdfb5b906210bc76cd",
            RewardVault: "0x5d62ccc1086f38286dc152962a4f3e337eec1ec1",
        }),
        [Category.RenEx]: OrderedMap({
            RenExBalances: "0xc5b98949AB0dfa0A7d4c07Bb29B002D6d6DA3e25",
            RenExSettlement: "0xfa0938e3c9a5e33b5084dfbffaca9241aef39be8",
            RenExTokens: "0x683fbabff57f1fa71f1b9e2a7eb2a2e11bd7723a",
            RenExAtomicInfo: "0x58a63bb3f707d3b8966b8436e75f29bd2e195ade",
            RenExAtomicSwapper: "0x027b780a3210702178db0719e42c66808840b0c7",
        }),
        [Category.Tokens]: OrderedMap({
            DGX: "0x0798297a11cefef7479e40e67839fee3c025691e",
            REN: "0x6f429121a3bd3e6c1c17edbc676eec44cf117faf",
            ABC: "0xc65d2e9c8924d4848935f4f22e3deca78c5217e5",
            XYZ: "0x5753addcd942b495b7297cbfc240a24ba7058274",
        }),
    }),
};

export const networks = [nightly, falcon, testnet];
