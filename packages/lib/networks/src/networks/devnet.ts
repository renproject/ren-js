import { AbiItem } from "web3-utils";
import zZEC from "darknode-sol/build/devnet/zZEC.json";
import ZECShifter from "darknode-sol/build/devnet/ZECShifter.json";
import zBTC from "darknode-sol/build/devnet/zBTC.json";
import ShifterRegistry from "darknode-sol/build/devnet/ShifterRegistry.json";
import RenToken from "darknode-sol/build/devnet/RenToken.json";
import DarknodeSlasher from "darknode-sol/build/devnet/DarknodeSlasher.json";
import DarknodeRegistryStore from "darknode-sol/build/devnet/DarknodeRegistryStore.json";
import DarknodeRegistry from "darknode-sol/build/devnet/DarknodeRegistry.json";
import DarknodePaymentStore from "darknode-sol/build/devnet/DarknodePaymentStore.json";
import DarknodePayment from "darknode-sol/build/devnet/DarknodePayment.json";
import BTCShifter from "darknode-sol/build/devnet/BTCShifter.json";
import ERC20 from "darknode-sol/build/erc/ERC20.json";

export default {
    name: "devnet",
    chain: "kovan",
    label: "Devnet",
    chainLabel: "Kovan",
    infura: "https://kovan.infura.io",
    etherscan: "https://kovan.etherscan.io",
    addresses: {
        ren: {
            DarknodeSlasher: {
                address: DarknodeSlasher.networks[42].address,
                abi: DarknodeSlasher.abi as AbiItem[],
            },
            DarknodeRegistry: {
                address: DarknodeRegistry.networks[42].address,
                abi: DarknodeRegistry.abi as AbiItem[],
                block: 11692743
            },
            DarknodeRegistryStore: {
                address: DarknodeRegistryStore.networks[42].address,
                abi: DarknodeRegistryStore.abi as AbiItem[],
            },
            DarknodePayment: {
                address: DarknodePayment.networks[42].address,
                abi: DarknodePayment.abi as AbiItem[],
            },
            DarknodePaymentStore: {
                address: DarknodePaymentStore.networks[42].address,
                abi: DarknodePaymentStore.abi as AbiItem[],
            }
        },
        shifter: {
            BTCShifter: {
                address: BTCShifter.networks[42].address,
                abi: BTCShifter.abi as AbiItem[],
            },
            ZECShifter: {
                address: ZECShifter.networks[42].address,
                abi: ZECShifter.abi as AbiItem[],
            },
            zBTC: {
                address: zBTC.networks[42].address,
                abi: zBTC.abi as AbiItem[],
            },
            zZEC: {
                address: zZEC.networks[42].address,
                abi: zZEC.abi as AbiItem[],
            },
            ShifterRegistry: {
                address: ShifterRegistry.networks[42].address,
                abi: ShifterRegistry.abi as AbiItem[],
            }
        },
        tokens: {
            DAI: {
                address: "0xc4375b7de8af5a38a93548eb8453a498222c4ff2",
                decimals: 18
            },
            BTC: {
                address: zBTC.networks[42].address,
                abi: zBTC.abi as AbiItem[],
                decimals: 8
            },
            ZEC: {
                address: zZEC.networks[42].address,
                abi: zZEC.abi as AbiItem[],
                decimals: 8
            },
            REN: {
                address: RenToken.networks[42].address,
                abi: RenToken.abi as AbiItem[],
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
            }
        }
    }
}