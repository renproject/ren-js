import ERC20 from "@renproject/sol/build/erc/ERC20.json";
import BasicAdapter from "@renproject/sol/build/testnet/BasicAdapter.json";
import DarknodePayment from "@renproject/sol/build/testnet/DarknodePayment.json";
import DarknodePaymentStore from "@renproject/sol/build/testnet/DarknodePaymentStore.json";
import DarknodeRegistryLogic from "@renproject/sol/build/testnet/DarknodeRegistryLogicV1.json";
import DarknodeRegistryProxy from "@renproject/sol/build/testnet/DarknodeRegistryProxy.json";
import DarknodeRegistryStore from "@renproject/sol/build/testnet/DarknodeRegistryStore.json";
import DarknodeSlasher from "@renproject/sol/build/testnet/DarknodeSlasher.json";
import GatewayLogic from "@renproject/sol/build/testnet/GatewayLogicV1.json";
import GatewayRegistry from "@renproject/sol/build/testnet/GatewayRegistry.json";
import ProtocolLogic from "@renproject/sol/build/testnet/ProtocolLogicV1.json";
import ProtocolProxy from "@renproject/sol/build/testnet/ProtocolProxy.json";
import RenToken from "@renproject/sol/build/testnet/RenToken.json";
import RenERC20 from "@renproject/sol/build/testnet/RenERC20LogicV1.json";
import { AbiItem } from "web3-utils";

import { CastNetwork, Contract } from "./network";

const networkID = 42;

// mintAuthority is generated by
// > utils.toChecksumAddress(utils.pubToAddress("... public key ...", true).toString("hex"))

export const renTestnet = CastNetwork({
    version: "1.0.0",
    name: "testnet" as "testnet",
    chain: "kovan",
    isTestnet: true,
    label: "Testnet",
    chainLabel: "Kovan",
    networkID,
    infura: "https://kovan.infura.io",
    etherscan: "https://kovan.etherscan.io",
    lightnode: "https://lightnode-testnet.herokuapp.com",
    addresses: {
        ren: {
            Protocol: {
                address: ProtocolProxy.networks[networkID].address,
                abi: ProtocolLogic.abi as AbiItem[],
                artifact: ProtocolProxy as Contract,
            },
            DarknodeSlasher: {
                address: DarknodeSlasher.networks[networkID].address,
                abi: DarknodeSlasher.abi as AbiItem[],
                artifact: DarknodeSlasher as Contract,
            },
            DarknodeRegistry: {
                address: DarknodeRegistryProxy.networks[networkID].address,
                abi: DarknodeRegistryLogic.abi as AbiItem[],
                artifact: DarknodeRegistryLogic as Contract,
                block: 17625998,
            },
            DarknodeRegistryStore: {
                address: DarknodeRegistryStore.networks[networkID].address,
                abi: DarknodeRegistryStore.abi as AbiItem[],
                artifact: DarknodeRegistryStore as Contract,
            },
            DarknodePayment: {
                address: DarknodePayment.networks[networkID].address,
                abi: DarknodePayment.abi as AbiItem[],
                artifact: DarknodePayment as Contract,
            },
            DarknodePaymentStore: {
                address: DarknodePaymentStore.networks[networkID].address,
                abi: DarknodePaymentStore.abi as AbiItem[],
                artifact: DarknodePaymentStore as Contract,
            },
        },
        gateways: {
            GatewayRegistry: {
                address: GatewayRegistry.networks[networkID].address,
                abi: GatewayRegistry.abi as AbiItem[],
                artifact: GatewayRegistry as Contract,
            },
            RenERC20: {
                abi: RenERC20.abi as AbiItem[],
                artifact: RenERC20 as Contract,
            },
            Gateway: {
                abi: GatewayLogic.abi as AbiItem[],
                artifact: GatewayLogic as Contract,
            },
            BasicAdapter: {
                address: BasicAdapter.networks[networkID].address,
                abi: BasicAdapter.abi as AbiItem[],
                artifact: BasicAdapter as Contract,
            },
        },
        tokens: {
            DAI: {
                address: "0xc4375b7de8af5a38a93548eb8453a498222c4ff2",
                decimals: 18,
            },
            REN: {
                address: RenToken.networks[networkID].address,
                abi: RenToken.abi as AbiItem[],
                artifact: RenToken as Contract,
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
                artifact: ERC20 as Contract,
            },
        },
    }
});