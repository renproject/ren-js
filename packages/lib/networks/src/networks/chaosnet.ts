import BasicAdapter from "darknode-sol/build/chaosnet/BasicAdapter.json";
import BCHShifter from "darknode-sol/build/chaosnet/BCHShifter.json";
import BTCShifter from "darknode-sol/build/chaosnet/BTCShifter.json";
import DarknodePayment from "darknode-sol/build/chaosnet/DarknodePayment.json";
import DarknodePaymentStore from "darknode-sol/build/chaosnet/DarknodePaymentStore.json";
import DarknodeRegistry from "darknode-sol/build/chaosnet/DarknodeRegistry.json";
import DarknodeRegistryStore from "darknode-sol/build/chaosnet/DarknodeRegistryStore.json";
import DarknodeSlasher from "darknode-sol/build/chaosnet/DarknodeSlasher.json";
import Protocol from "darknode-sol/build/chaosnet/Protocol.json";
import ProtocolLogic from "darknode-sol/build/chaosnet/ProtocolLogic.json";
import RenToken from "darknode-sol/build/chaosnet/RenToken.json";
import ShifterRegistry from "darknode-sol/build/chaosnet/ShifterRegistry.json";
import zBCH from "darknode-sol/build/chaosnet/zBCH.json";
import zBTC from "darknode-sol/build/chaosnet/zBTC.json";
import ZECShifter from "darknode-sol/build/chaosnet/ZECShifter.json";
import zZEC from "darknode-sol/build/chaosnet/zZEC.json";
import ERC20 from "darknode-sol/build/erc/ERC20.json";
import { AbiItem } from "web3-utils";

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
            Protocol: {
                address: Protocol.networks[networkID].address,
                abi: ProtocolLogic.abi as AbiItem[],
                artifact: Protocol,
            },
            DarknodeRegistry: {
                address: DarknodeRegistry.networks[networkID].address,
                abi: DarknodeRegistry.abi as AbiItem[],
                artifact: DarknodeRegistry,
                block: 7007558
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
                description: "shifterRegistry.getTokenBySymbol(zBTC)",
            },
            BTCShifter: {
                _address: BTCShifter.networks[networkID].address,
                abi: BTCShifter.abi as AbiItem[],
                artifact: BTCShifter,
                description: "shifterRegistry.getShifterBySymbol(zBTC)",
            },
            zZEC: {
                _address: zZEC.networks[networkID].address,
                abi: zZEC.abi as AbiItem[],
                artifact: zZEC,
                description: "shifterRegistry.getTokenBySymbol(zZEC)",
            },
            ZECShifter: {
                _address: ZECShifter.networks[networkID].address,
                abi: ZECShifter.abi as AbiItem[],
                artifact: ZECShifter,
                description: "shifterRegistry.getShifterBySymbol(zZEC)",
            },
            zBCH: {
                _address: zBCH.networks[networkID].address,
                abi: zBCH.abi as AbiItem[],
                artifact: zBCH,
                description: "shifterRegistry.getTokenBySymbol(zBCH)",
            },
            BCHShifter: {
                _address: BCHShifter.networks[networkID].address,
                abi: BCHShifter.abi as AbiItem[],
                artifact: BCHShifter,
                description: "shifterRegistry.getShifterBySymbol(zBCH)",
            },
            BasicAdapter: {
                address: BasicAdapter.networks[networkID].address,
                abi: BasicAdapter.abi as AbiItem[],
                artifact: BasicAdapter,
            },
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
