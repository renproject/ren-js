import { AbiItem } from "web3-utils";
import zZEC from "darknode-sol/build/localnet/zZEC.json";
import ZECShifter from "darknode-sol/build/localnet/ZECShifter.json";
import zBTC from "darknode-sol/build/localnet/zBTC.json";
import zBCH from "darknode-sol/build/localnet/zBCH.json";
import BCHShifter from "darknode-sol/build/localnet/BCHShifter.json";
import ShifterRegistry from "darknode-sol/build/localnet/ShifterRegistry.json";
import RenToken from "darknode-sol/build/localnet/RenToken.json";
import DarknodeSlasher from "darknode-sol/build/localnet/DarknodeSlasher.json";
import DarknodeRegistryStore from "darknode-sol/build/localnet/DarknodeRegistryStore.json";
import DarknodeRegistry from "darknode-sol/build/localnet/DarknodeRegistry.json";
import DarknodePaymentStore from "darknode-sol/build/localnet/DarknodePaymentStore.json";
import DarknodePayment from "darknode-sol/build/localnet/DarknodePayment.json";
import BTCShifter from "darknode-sol/build/localnet/BTCShifter.json";
import ERC20 from "darknode-sol/build/erc/ERC20.json";

import { Network } from "./network";

const networkID = 42;

export default Network({
    name: "localnet",
    chain: "kovan",
    label: "Localnet",
    chainLabel: "Kovan",
    networkID,
    infura: "https://kovan.infura.io",
    etherscan: "https://kovan.etherscan.io",
    renVM: {
        mpkh: "0x0c0b293a30e5398533783f344c296f57d78e4cbc",
        mintAuthority: "0x04084f1cACCB87Dcab9a29a084281294dA96Bf44",
    },
    addresses: {
        ren: {
            DarknodeSlasher: {
                address: DarknodeSlasher.networks[networkID].address,
                abi: DarknodeSlasher.abi as AbiItem[],
                artifact: DarknodeSlasher,
            },
            DarknodeRegistry: {
                address: DarknodeRegistry.networks[networkID].address,
                abi: DarknodeRegistry.abi as AbiItem[],
                artifact: DarknodeRegistry,
                block: 11974083
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
