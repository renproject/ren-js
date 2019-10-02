import { AbiItem } from "web3-utils";
import DarknodePayment from "darknode-sol/build/main/DarknodePayment.json";
import DarknodePaymentStore from "darknode-sol/build/main/DarknodePaymentStore.json";
import DarknodeRegistry from "darknode-sol/build/main/DarknodeRegistry.json";
import DarknodeRegistryStore from "darknode-sol/build/main/DarknodeRegistryStore.json";
import DarknodeRewardVault from "darknode-sol/build/main/DarknodeRewardVault.json";
import RenToken from "darknode-sol/build/main/RenToken.json";
import ERC20 from "darknode-sol/build/erc/ERC20.json";

import { Network } from "./network";

const networkID = 1;

export default Network({
    name: "chaosnet",
    chain: "main",
    label: "Chaosnet",
    chainLabel: "Mainnet",
    networkID,
    infura: "https://mainnet.infura.io",
    etherscan: "https://etherscan.io",
    renVM: {
        mpkh: "",
        mintAuthority: "",
    },
    addresses: {
        ren: {
            DarknodeRegistryStore: {
                address: DarknodeRegistryStore.networks[networkID].address,
                abi: DarknodeRegistryStore.abi as AbiItem[],
                artifact: DarknodeRegistryStore,
            },
            DarknodeRegistry: {
                address: DarknodeRegistry.networks[networkID].address,
                abi: DarknodeRegistry.abi as AbiItem[],
                artifact: DarknodeRegistry,
                block: 7007558
            },
            SettlementRegistry: {
                address: "0x119da7a8500ade0766f758d934808179dc551036"
            },
            Orderbook: {
                address: "0x6b8bb175c092de7d81860b18db360b734a2598e0"
            },
            DarknodeRewardVault: {
                address: DarknodeRewardVault.networks[networkID].address,
                abi: DarknodeRewardVault.abi as AbiItem[],
                artifact: DarknodeRewardVault,
            },
            DarknodeSlasher: {
                address: "0x0000000000000000000000000000000000000000"
            },
            DarknodePayment: {
                address: DarknodePayment.networks[networkID].address,
                abi: DarknodePayment.abi as AbiItem[],
                artifact: DarknodePayment,
            },
            DarknodePaymentStore: {
                address: DarknodePaymentStore.networks[networkID].address,
                abi: DarknodePaymentStore.abi as AbiItem[],
                artifact: DarknodePaymentStore,
            }
        },
        shifter: {
            zBTC: {
                address: "",
                abi: [] as AbiItem[],
                artifact: {
                    abi: [],
                },
            },
            BTCShifter: {
                address: "",
                abi: [] as AbiItem[],
                artifact: {
                    abi: [],
                },
            },
            zZEC: {
                address: "",
                abi: [] as AbiItem[],
                artifact: {
                    abi: [],
                },
            },
            ZECShifter: {
                address: "",
                abi: [] as AbiItem[],
                artifact: {
                    abi: [],
                },
            },
            zBCH: {
                address: "",
                abi: [] as AbiItem[],
                artifact: {
                    abi: [],
                },
            },
            BCHShifter: {
                address: "",
                abi: [] as AbiItem[],
                artifact: {
                    abi: [],
                },
            },
            ShifterRegistry: {
                address: "",
                abi: [] as AbiItem[],
                artifact: {
                    abi: [],
                },
            }
        },
        tokens: {
            REN: {
                address: RenToken.networks[networkID].address,
                abi: RenToken.abi as AbiItem[],
                artifact: RenToken,
                decimals: 18,
            },
            DAI: {
                address: "0x89d24A6b4CcB1B6fAA2625fE562bDD9a23260359",
                decimals: 18,
            }
        },
        erc: {
            ERC20: {
                abi: ERC20.abi as AbiItem[],
                artifact: ERC20,
            }
        }
    }
});
