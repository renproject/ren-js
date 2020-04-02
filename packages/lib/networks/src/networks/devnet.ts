import BasicAdapter from "darknode-sol/build/devnet/BasicAdapter.json";
import BCHGateway from "darknode-sol/build/devnet/BCHGateway.json";
import BTCGateway from "darknode-sol/build/devnet/BTCGateway.json";
import DarknodePayment from "darknode-sol/build/devnet/DarknodePayment.json";
import DarknodePaymentStore from "darknode-sol/build/devnet/DarknodePaymentStore.json";
import DarknodeRegistryLogic from "darknode-sol/build/devnet/DarknodeRegistryLogicV1.json";
import DarknodeRegistryProxy from "darknode-sol/build/devnet/DarknodeRegistryProxy.json";
import DarknodeRegistryStore from "darknode-sol/build/devnet/DarknodeRegistryStore.json";
import DarknodeSlasher from "darknode-sol/build/devnet/DarknodeSlasher.json";
import GatewayLogic from "darknode-sol/build/devnet/GatewayLogicV1.json";
import GatewayRegistry from "darknode-sol/build/devnet/GatewayRegistry.json";
import ProtocolLogic from "darknode-sol/build/devnet/ProtocolLogicV1.json";
import ProtocolProxy from "darknode-sol/build/devnet/ProtocolProxy.json";
import RenBCH from "darknode-sol/build/devnet/RenBCH.json";
import RenBTC from "darknode-sol/build/devnet/RenBTC.json";
import RenToken from "darknode-sol/build/devnet/RenToken.json";
import RenZEC from "darknode-sol/build/devnet/RenZEC.json";
import ZECGateway from "darknode-sol/build/devnet/ZECGateway.json";
import ERC20 from "darknode-sol/build/erc/ERC20.json";
import { AbiItem } from "web3-utils";

import { Network } from "./network";

const networkID = 42;

export default Network({
    version: "1.0.0",
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
            Protocol: {
                address: ProtocolProxy.networks[networkID].address,
                abi: ProtocolLogic.abi as AbiItem[],
                artifact: ProtocolProxy,
            },
            DarknodeSlasher: {
                address: DarknodeSlasher.networks[networkID].address,
                abi: DarknodeSlasher.abi as AbiItem[],
                artifact: DarknodeSlasher,
            },
            DarknodeRegistry: {
                address: DarknodeRegistryProxy.networks[networkID].address,
                abi: DarknodeRegistryLogic.abi as AbiItem[],
                artifact: DarknodeRegistryLogic,
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
        },
        shifter: {
            GatewayRegistry: {
                address: GatewayRegistry.networks[networkID].address,
                abi: GatewayRegistry.abi as AbiItem[],
                artifact: GatewayRegistry,
            },
            RenBTC: {
                _address: RenBTC.networks[networkID].address,
                abi: RenBTC.abi as AbiItem[],
                artifact: RenBTC,
                description: "gatewayRegistry.getTokenBySymbol(\"BTC\")",
            },
            BTCGateway: {
                _address: BTCGateway.networks[networkID].address,
                abi: GatewayLogic.abi as AbiItem[],
                artifact: GatewayLogic,
                description: "gatewayRegistry.getGatewayBySymbol(\"BTC\")",
            },
            RenZEC: {
                _address: RenZEC.networks[networkID].address,
                abi: RenZEC.abi as AbiItem[],
                artifact: RenZEC,
                description: "gatewayRegistry.getTokenBySymbol(\"ZEC\")",
            },
            ZECGateway: {
                _address: ZECGateway.networks[networkID].address,
                abi: GatewayLogic.abi as AbiItem[],
                artifact: GatewayLogic,
                description: "gatewayRegistry.getGatewayBySymbol(\"ZEC\")",
            },
            RenBCH: {
                _address: RenBCH.networks[networkID].address,
                abi: RenBCH.abi as AbiItem[],
                artifact: RenBCH,
                description: "gatewayRegistry.getTokenBySymbol(\"BCH\")",
            },
            BCHGateway: {
                _address: BCHGateway.networks[networkID].address,
                abi: GatewayLogic.abi as AbiItem[],
                artifact: GatewayLogic,
                description: "gatewayRegistry.getGatewayBySymbol(\"BCH\")",
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
                address: RenBTC.networks[networkID].address,
                abi: RenBTC.abi as AbiItem[],
                artifact: RenBTC,
                decimals: 8
            },
            ZEC: {
                address: RenZEC.networks[networkID].address,
                abi: RenZEC.abi as AbiItem[],
                artifact: RenZEC,
                decimals: 8
            },
            BCH: {
                address: RenBCH.networks[networkID].address,
                abi: RenBCH.abi as AbiItem[],
                artifact: RenBCH,
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
