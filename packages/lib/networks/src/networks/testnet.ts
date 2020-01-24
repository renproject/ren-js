import ERC20 from "darknode-sol/build/erc/ERC20.json";
import BCHShifter from "darknode-sol/build/testnet/BCHShifter.json";
import BTCShifter from "darknode-sol/build/testnet/BTCShifter.json";
import DarknodePayment from "darknode-sol/build/testnet/DarknodePayment.json";
import DarknodePaymentStore from "darknode-sol/build/testnet/DarknodePaymentStore.json";
import DarknodeRegistry from "darknode-sol/build/testnet/DarknodeRegistry.json";
import DarknodeRegistryStore from "darknode-sol/build/testnet/DarknodeRegistryStore.json";
import DarknodeSlasher from "darknode-sol/build/testnet/DarknodeSlasher.json";
import Protocol from "darknode-sol/build/testnet/Protocol.json";
import ProtocolLogic from "darknode-sol/build/testnet/ProtocolLogic.json";
import RenToken from "darknode-sol/build/testnet/RenToken.json";
import ShifterRegistry from "darknode-sol/build/testnet/ShifterRegistry.json";
import zBCH from "darknode-sol/build/testnet/zBCH.json";
import zBTC from "darknode-sol/build/testnet/zBTC.json";
import ZECShifter from "darknode-sol/build/testnet/ZECShifter.json";
import zZEC from "darknode-sol/build/testnet/zZEC.json";
import { AbiItem } from "web3-utils";

import { Network } from "./network";

const networkID = 42;

export default Network({
    name: "testnet",
    chain: "kovan",
    label: "Testnet",
    chainLabel: "Kovan",
    networkID,
    infura: "https://kovan.infura.io",
    etherscan: "https://kovan.etherscan.io",
    renVM: {
        mpkh: "0xc998b2a88ac96676e14f07739003419799a6823a",
        mintAuthority: "0x44Bb4eF43408072bC888Afd1a5986ba0Ce35Cb54",
    },
    addresses: {
        ren: {
            Protocol: {
                address: Protocol.networks[networkID].address,
                abi: ProtocolLogic.abi as AbiItem[],
                artifact: Protocol,
            },
            DarknodeRegistry: {
                address: DarknodeRegistry.networks[networkID].address,
                abi: DarknodeRegistry.abi as AbiItem[],
                artifact: DarknodeRegistry,
                block: 10705530,
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
                decimals: 18,
            },
            BTC: {
                address: zBTC.networks[networkID].address,
                abi: zBTC.abi as AbiItem[],
                artifact: zBTC,
                decimals: 8,
            },
            ZEC: {
                address: zZEC.networks[networkID].address,
                abi: zZEC.abi as AbiItem[],
                artifact: zZEC,
                decimals: 8,
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
                decimals: 18,
            },
            ETH: {
                address: "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee",
                decimals: 18,
            },
        },
        erc: {
            ERC20: {
                abi: ERC20.abi as AbiItem[],
                artifact: ERC20,
            },
        },
    }
});
