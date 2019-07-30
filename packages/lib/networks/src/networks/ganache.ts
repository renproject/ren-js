import { AbiItem } from "web3-utils";
import { join } from "path";

import { Network } from "./network";

export default (buildPath: string, networkID: number) => {
    const zZEC = require(join(buildPath, "zZEC.json"));
    const ZECShifter = require(join(buildPath, "ZECShifter.json"));
    const zBTC = require(join(buildPath, "zBTC.json"));
    const ShifterRegistry = require(join(buildPath, "ShifterRegistry.json"));
    const RenToken = require(join(buildPath, "RenToken.json"));
    const DarknodeSlasher = require(join(buildPath, "DarknodeSlasher.json"));
    const DarknodeRegistryStore = require(join(buildPath, "DarknodeRegistryStore.json"));
    const DarknodeRegistry = require(join(buildPath, "DarknodeRegistry.json"));
    const DarknodePaymentStore = require(join(buildPath, "DarknodePaymentStore.json"));
    const DarknodePayment = require(join(buildPath, "DarknodePayment.json"));
    const BTCShifter = require(join(buildPath, "BTCShifter.json"));
    const ERC20 = require("darknode-sol/build/erc/ERC20.json");

    return Network({
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
                },
                DarknodeRegistry: {
                    address: DarknodeRegistry.networks[networkID].address,
                    abi: DarknodeRegistry.abi as AbiItem[],
                    block: 0
                },
                DarknodeRegistryStore: {
                    address: DarknodeRegistryStore.networks[networkID].address,
                    abi: DarknodeRegistryStore.abi as AbiItem[],
                },
                DarknodePayment: {
                    address: DarknodePayment.networks[networkID].address,
                    abi: DarknodePayment.abi as AbiItem[],
                },
                DarknodePaymentStore: {
                    address: DarknodePaymentStore.networks[networkID].address,
                    abi: DarknodePaymentStore.abi as AbiItem[],
                }
            },
            shifter: {
                BTCShifter: {
                    address: BTCShifter.networks[networkID].address,
                    abi: BTCShifter.abi as AbiItem[],
                },
                ZECShifter: {
                    address: ZECShifter.networks[networkID].address,
                    abi: ZECShifter.abi as AbiItem[],
                },
                zBTC: {
                    address: zBTC.networks[networkID].address,
                    abi: zBTC.abi as AbiItem[],
                },
                zZEC: {
                    address: zZEC.networks[networkID].address,
                    abi: zZEC.abi as AbiItem[],
                },
                ShifterRegistry: {
                    address: ShifterRegistry.networks[networkID].address,
                    abi: ShifterRegistry.abi as AbiItem[],
                }
            },
            tokens: {
                DAI: {
                    address: "0xc4375b7de8af5a38a93548eb8453a498222c4ff2",
                    decimals: 18
                },
                BTC: {
                    address: zBTC.networks[networkID].address,
                    abi: zBTC.abi as AbiItem[],
                    decimals: 8
                },
                ZEC: {
                    address: zZEC.networks[networkID].address,
                    abi: zZEC.abi as AbiItem[],
                    decimals: 8
                },
                REN: {
                    address: RenToken.networks[networkID].address,
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
    });
}