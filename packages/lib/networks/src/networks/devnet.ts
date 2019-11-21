import { AbiItem } from "web3-utils";
import zBTC from "darknode-sol/build/devnet/zBTC.json";
import BTCShifter from "darknode-sol/build/devnet/BTCShifter.json";
import zZEC from "darknode-sol/build/devnet/zZEC.json";
import ZECShifter from "darknode-sol/build/devnet/ZECShifter.json";
import zBCH from "darknode-sol/build/devnet/zBCH.json";
import BCHShifter from "darknode-sol/build/devnet/BCHShifter.json";
import ShifterRegistry from "darknode-sol/build/devnet/ShifterRegistry.json";
import RenToken from "darknode-sol/build/devnet/RenToken.json";
import DarknodeSlasher from "darknode-sol/build/devnet/DarknodeSlasher.json";
import DarknodeRegistryStore from "darknode-sol/build/devnet/DarknodeRegistryStore.json";
import DarknodeRegistry from "darknode-sol/build/devnet/DarknodeRegistry.json";
import DarknodePaymentStore from "darknode-sol/build/devnet/DarknodePaymentStore.json";
import DarknodePayment from "darknode-sol/build/devnet/DarknodePayment.json";
import ERC20 from "darknode-sol/build/erc/ERC20.json";

import { Network } from "./network";

const networkID = 42;

export default Network({
    name: "devnet",
    chain: "kovan",
    label: "Devnet",
    chainLabel: "Kovan",
    networkID,
    infura: "https://kovan.infura.io",
    etherscan: "https://kovan.etherscan.io",
    renVM: {
        mpkh: "0x90081b2120fcd9230001f4026c207bf2633ede35",
        mintAuthority: "0x1B9d58208879AA9aa9E10040b34cF2b684237621",
    },
    addresses: {
        ren: {
            DarknodeRegistry: {
                address: DarknodeRegistry.networks[networkID].address,
                abi: DarknodeRegistry.abi as AbiItem[],
                artifact: DarknodeRegistry,
                block: 11692743
            },
            DarknodeRegistryStore: {
                address: DarknodeRegistryStore.networks[networkID].address,
                abi: DarknodeRegistryStore.abi as AbiItem[],
                artifact: DarknodeRegistryStore,
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
            },
            DarknodeSlasher: {
                address: DarknodeSlasher.networks[networkID].address,
                abi: DarknodeSlasher.abi as AbiItem[],
                artifact: DarknodeSlasher,
            },
        },
        shifter: {
            ShifterRegistry: {
                address: ShifterRegistry.networks[networkID].address,
                abi: ShifterRegistry.abi as AbiItem[],
                artifact: ShifterRegistry,
            },
            zBTC: {
                _address: zBTC.networks[networkID].address,
                abi: zBTC.abi as AbiItem[],
                artifact: zBTC,
            },
            BTCShifter: {
                _address: BTCShifter.networks[networkID].address,
                abi: BTCShifter.abi as AbiItem[],
                artifact: BTCShifter,
            },
            zZEC: {
                _address: zZEC.networks[networkID].address,
                abi: zZEC.abi as AbiItem[],
                artifact: zZEC,
            },
            ZECShifter: {
                _address: ZECShifter.networks[networkID].address,
                abi: ZECShifter.abi as AbiItem[],
                artifact: ZECShifter,
            },
            zBCH: {
                _address: zBCH.networks[networkID].address,
                abi: zBCH.abi as AbiItem[],
                artifact: zBCH,
            },
            BCHShifter: {
                _address: BCHShifter.networks[networkID].address,
                abi: BCHShifter.abi as AbiItem[],
                artifact: BCHShifter,
            },
        },
        tokens: {
            DAI: {
                address: "0xc4375b7de8af5a38a93548eb8453a498222c4ff2",
                decimals: 18
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
            },
        },
        erc: {
            ERC20: {
                abi: ERC20.abi as AbiItem[],
                artifact: ERC20,
            },
        }
    }
});
