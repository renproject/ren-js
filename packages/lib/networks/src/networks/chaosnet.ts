import { AbiItem } from "web3-utils";
import zBTC from "darknode-sol/build/chaosnet/zBTC.json";
import BTCShifter from "darknode-sol/build/chaosnet/BTCShifter.json";
import zZEC from "darknode-sol/build/chaosnet/zZEC.json";
import ZECShifter from "darknode-sol/build/chaosnet/ZECShifter.json";
import zBCH from "darknode-sol/build/chaosnet/zBCH.json";
import BCHShifter from "darknode-sol/build/chaosnet/BCHShifter.json";
import ShifterRegistry from "darknode-sol/build/chaosnet/ShifterRegistry.json";
import DarknodePayment from "darknode-sol/build/chaosnet/DarknodePayment.json";
import DarknodePaymentStore from "darknode-sol/build/chaosnet/DarknodePaymentStore.json";
import DarknodeRegistry from "darknode-sol/build/chaosnet/DarknodeRegistry.json";
import DarknodeRegistryStore from "darknode-sol/build/chaosnet/DarknodeRegistryStore.json";
import RenToken from "darknode-sol/build/chaosnet/RenToken.json";
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
        mpkh: "0x8444bb73145bffb7d063853a44c21e898152ceeb",
        mintAuthority: "0x5D0b91e8a8037C3EBB55f52D76BFc64CaBEBCAE1",
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
                address: zBTC.networks[networkID].address,
                abi: zBTC.abi as AbiItem[],
                artifact: zBTC,
            },
            BTCShifter: {
                address: BTCShifter.networks[networkID].address,
                abi: BTCShifter.abi as AbiItem[],
                artifact: BTCShifter,
            },
            zZEC: {
                address: zZEC.networks[networkID].address,
                abi: zZEC.abi as AbiItem[],
                artifact: zZEC,
            },
            ZECShifter: {
                address: ZECShifter.networks[networkID].address,
                abi: ZECShifter.abi as AbiItem[],
                artifact: ZECShifter,
            },
            zBCH: {
                address: zBCH.networks[networkID].address,
                abi: zBCH.abi as AbiItem[],
                artifact: zBCH,
            },
            BCHShifter: {
                address: BCHShifter.networks[networkID].address,
                abi: BCHShifter.abi as AbiItem[],
                artifact: BCHShifter,
            },
            ShifterRegistry: {
                address: ShifterRegistry.networks[networkID].address,
                abi: ShifterRegistry.abi as AbiItem[],
                artifact: ShifterRegistry,
            }
        },
        tokens: {
            DAI: {
                address: "0x89d24A6b4CcB1B6fAA2625fE562bDD9a23260359",
                decimals: 18,
            },
            BTC: {
                address: zBTC.networks[networkID].address,
                abi: zBTC.abi as AbiItem[],
                artifact: zBTC,
                decimals: 8
            },
            ZEC: {
                address: zZEC.networks[networkID].address,
                abi: zZEC.abi as AbiItem[],
                artifact: zZEC,
                decimals: 8
            },
            BCH: {
                address: zBCH.networks[networkID].address,
                abi: zBCH.abi as AbiItem[],
                artifact: zBCH,
                decimals: 8
            },
            REN: {
                address: RenToken.networks[networkID].address,
                abi: RenToken.abi as AbiItem[],
                artifact: RenToken,
                decimals: 18
            },
            ETH: {
                address: "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee",
                decimals: 18
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
