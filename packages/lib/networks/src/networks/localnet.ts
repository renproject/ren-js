import Protocol from "darknode-sol/build/devnet/Protocol.json";
import ProtocolLogic from "darknode-sol/build/devnet/ProtocolLogic.json";
import ERC20 from "darknode-sol/build/erc/ERC20.json";
import BasicAdapter from "darknode-sol/build/localnet/BasicAdapter.json";
import BCHShifter from "darknode-sol/build/localnet/BCHShifter.json";
import BTCShifter from "darknode-sol/build/localnet/BTCShifter.json";
import DarknodePayment from "darknode-sol/build/localnet/DarknodePayment.json";
import DarknodePaymentStore from "darknode-sol/build/localnet/DarknodePaymentStore.json";
import DarknodeRegistry from "darknode-sol/build/localnet/DarknodeRegistry.json";
import DarknodeRegistryStore from "darknode-sol/build/localnet/DarknodeRegistryStore.json";
import DarknodeSlasher from "darknode-sol/build/localnet/DarknodeSlasher.json";
import RenToken from "darknode-sol/build/localnet/RenToken.json";
import ShifterRegistry from "darknode-sol/build/localnet/ShifterRegistry.json";
import zBCH from "darknode-sol/build/localnet/zBCH.json";
import zBTC from "darknode-sol/build/localnet/zBTC.json";
import ZECShifter from "darknode-sol/build/localnet/ZECShifter.json";
import zZEC from "darknode-sol/build/localnet/zZEC.json";
import { AbiItem } from "web3-utils";

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
            Protocol: {
                address: Protocol.networks[networkID].address,
                abi: ProtocolLogic.abi as AbiItem[],
                artifact: Protocol,
            },
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
            BasicAdapter: {
                address: BasicAdapter.networks[networkID].address,
                abi: BasicAdapter.abi as AbiItem[],
                artifact: BasicAdapter,
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
